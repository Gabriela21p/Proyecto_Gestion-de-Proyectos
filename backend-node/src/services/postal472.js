import { config } from '../config.js';
import { query } from '../db/postgres.js';

let tokenCache = { value: '', expiresAt: 0 };
let tokenPromise = null;

export async function resolveRollingAddress({
  address,
  department,
  municipality,
  divipola,
  allowLive = true
}) {
  const queryAddress = clean(address);
  if (!queryAddress) return { found: false, source: 'rolling_address_db', reason: 'address_required' };

  const resolvedMunicipality = await resolveMunicipalityIdentity({ department, municipality, divipola });
  const addressKey = normalizeAddressKey(queryAddress);

  const learned = await findLearnedAddress({
    addressKey,
    divipola: resolvedMunicipality?.divipola || divipola
  });

  if (learned) {
    await query('UPDATE address_resolutions SET last_used_at = now() WHERE id = $1', [learned.id]);
    return toAddressResult(learned, 'rolling_address_db', true);
  }

  if (!allowLive) {
    return {
      found: false,
      source: 'rolling_address_db',
      reason: 'not_learned',
      municipality: resolvedMunicipality
    };
  }

  if (!resolvedMunicipality?.divipola || !resolvedMunicipality?.department || !resolvedMunicipality?.municipality) {
    return {
      found: false,
      source: 'rolling_address_db',
      reason: 'municipality_not_learned',
      message: 'Rolling aun no conoce el DIVIPOLA de este municipio. Envia divipola/departamento/municipio una vez para aprenderlo.'
    };
  }

  const official = await resolveOfficial472({
    address: queryAddress,
    department: resolvedMunicipality.department,
    municipality: officialMunicipality(resolvedMunicipality.department, resolvedMunicipality.municipality),
    divipola: resolvedMunicipality.divipola
  });

  if (!official) {
    return {
      found: false,
      source: 'official_472',
      reason: 'official_no_result',
      municipality: resolvedMunicipality
    };
  }

  const saved = await learnOfficialAddress({
    queryAddress,
    addressKey,
    department: resolvedMunicipality.department,
    municipality: resolvedMunicipality.municipality,
    divipola: resolvedMunicipality.divipola,
    official
  });

  return toAddressResult(saved, 'official_472', false);
}

export async function learnClientOfficial472({
  address,
  department,
  municipality,
  divipola,
  postalCode,
  expandedPostalCode,
  standardAddress,
  lat,
  lon,
  raw
}) {
  if (!address || !department || !municipality || !divipola || !postalCode || !standardAddress) {
    throw new Error('Resultado 4-72 incompleto');
  }

  const official = {
    postal_code: String(postalCode),
    expanded_postal_code: expandedPostalCode ? String(expandedPostalCode) : null,
    standard_address: String(standardAddress),
    lat: numericOrNull(lat),
    lon: numericOrNull(lon),
    raw: raw || null
  };

  return learnOfficialAddress({
    queryAddress: clean(address),
    addressKey: normalizeAddressKey(address),
    department: clean(department).toUpperCase(),
    municipality: clean(municipality).toUpperCase(),
    divipola: String(divipola).replace(/\D/g, '').padStart(5, '0'),
    official,
    source: 'official_472_device'
  });
}

async function resolveMunicipalityIdentity({ department, municipality, divipola }) {
  const municipalityInput = clean(municipality);
  const departmentInput = clean(department);
  const divipolaInput = String(divipola || '').replace(/\D/g, '').padStart(divipola ? 5 : 0, '0');

  if (isBogota(departmentInput, municipalityInput)) {
    return { department: 'BOGOTA D.C.', municipality: 'BOGOTA D.C.', divipola: '11001' };
  }

  if (divipolaInput && departmentInput && municipalityInput) {
    await learnMunicipality({
      divipola: divipolaInput,
      department: departmentInput,
      municipality: municipalityInput,
      source: 'client'
    });
    return {
      department: departmentInput.toUpperCase(),
      municipality: municipalityInput.toUpperCase(),
      divipola: divipolaInput
    };
  }

  if (divipolaInput) {
    const byDvp = await query(
      'SELECT divipola, department, municipality FROM postal_municipalities WHERE divipola = $1 LIMIT 1',
      [divipolaInput]
    );
    if (byDvp.rowCount) return byDvp.rows[0];
  }

  if (municipalityInput) {
    const municipalityKey = normalizeText(municipalityInput);
    const departmentKey = normalizeText(departmentInput);
    const result = await query(
      `
        SELECT divipola, department, municipality
        FROM postal_municipalities
        WHERE municipality_key = $1
          AND ($2 = '' OR department_key = $2)
        ORDER BY last_verified_at DESC
        LIMIT 1
      `,
      [municipalityKey, departmentKey]
    );
    if (result.rowCount) return result.rows[0];
  }

  return null;
}

async function findLearnedAddress({ addressKey, divipola }) {
  const result = await query(
    `
      SELECT *
      FROM address_resolutions
      WHERE address_key = $1
        AND ($2 = '' OR divipola = $2)
        AND confidence >= 0.95
      ORDER BY last_verified_at DESC
      LIMIT 1
    `,
    [addressKey, String(divipola || '')]
  );
  return result.rows[0] || null;
}

async function resolveOfficial472({ address, department, municipality, divipola }) {
  const token = await getOfficialToken();
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.official472TimeoutMs);
  try {
    const response = await fetch(config.official472EntryUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*'
      },
      body: JSON.stringify({
        token,
        departamento: department.toUpperCase(),
        municipio: municipality.toUpperCase(),
        dvp: divipola,
        direccion: address.replaceAll('"', "'")
      }),
      signal: controller.signal
    });

    if (!response.ok) return null;
    const data = await response.json();
    if (String(data?.status) !== '200' || !data?.cp) return null;

    return {
      postal_code: String(data.cp).trim(),
      expanded_postal_code: String(data.cp_ampliado || '').trim() || null,
      standard_address: clean(data.direccion_estandar) || address,
      lat: numericOrNull(data.lat),
      lon: numericOrNull(data.lon),
      wkid: data.wkid || null,
      raw: data
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getOfficialToken() {
  if (tokenCache.value && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.official472TokenTimeoutMs);
    try {
      const response = await fetch(config.official472TokenUrl, { signal: controller.signal });
      if (!response.ok) return '';
      const text = await response.text();
      const match = text.match(/userToken472\s*=\s*'([^']+)'/);
      if (!match?.[1]) return '';
      tokenCache = {
        value: match[1],
        expiresAt: Date.now() + config.official472TokenTtlMs
      };
      return tokenCache.value;
    } catch {
      return '';
    } finally {
      clearTimeout(timeout);
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

async function learnOfficialAddress({
  queryAddress,
  addressKey,
  department,
  municipality,
  divipola,
  official,
  source = 'official_472'
}) {
  await learnMunicipality({ divipola, department, municipality, source });

  const result = await query(
    `
      INSERT INTO address_resolutions(
        address_key, query_address, standard_address, department, department_key,
        municipality, municipality_key, divipola, postal_code, expanded_postal_code,
        lat, lng, source, confidence, verification_count, raw_response,
        first_seen_at, last_verified_at, last_used_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1.0,1,$14,now(),now(),now())
      ON CONFLICT(address_key, divipola)
      DO UPDATE SET
        query_address = EXCLUDED.query_address,
        standard_address = EXCLUDED.standard_address,
        department = EXCLUDED.department,
        department_key = EXCLUDED.department_key,
        municipality = EXCLUDED.municipality,
        municipality_key = EXCLUDED.municipality_key,
        postal_code = EXCLUDED.postal_code,
        expanded_postal_code = EXCLUDED.expanded_postal_code,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        source = EXCLUDED.source,
        confidence = 1.0,
        verification_count = address_resolutions.verification_count + 1,
        raw_response = EXCLUDED.raw_response,
        last_verified_at = now(),
        last_used_at = now()
      RETURNING *
    `,
    [
      addressKey,
      queryAddress,
      official.standard_address,
      department.toUpperCase(),
      normalizeText(department),
      municipality.toUpperCase(),
      normalizeText(municipality),
      divipola,
      official.postal_code,
      official.expanded_postal_code,
      official.lat,
      official.lon,
      source,
      official.raw ? JSON.stringify(official.raw) : null
    ]
  );
  return result.rows[0];
}

async function learnMunicipality({ divipola, department, municipality, source }) {
  if (!divipola || !department || !municipality) return;
  await query(
    `
      INSERT INTO postal_municipalities(divipola, department, department_key, municipality, municipality_key, source, last_verified_at)
      VALUES($1,$2,$3,$4,$5,$6,now())
      ON CONFLICT(divipola)
      DO UPDATE SET
        department = EXCLUDED.department,
        department_key = EXCLUDED.department_key,
        municipality = EXCLUDED.municipality,
        municipality_key = EXCLUDED.municipality_key,
        source = CASE
          WHEN postal_municipalities.source LIKE 'official_472%' THEN postal_municipalities.source
          ELSE EXCLUDED.source
        END,
        last_verified_at = now()
    `,
    [
      divipola,
      department.toUpperCase(),
      normalizeText(department),
      municipality.toUpperCase(),
      normalizeText(municipality),
      source
    ]
  );
}

function toAddressResult(row, source, cacheHit) {
  return {
    found: true,
    source,
    cache_hit: cacheHit,
    provider: row.source,
    address: row.query_address,
    standard_address: row.standard_address,
    department: row.department,
    municipality: row.municipality,
    divipola: row.divipola,
    postal_code: row.postal_code,
    expanded_postal_code: row.expanded_postal_code,
    lat: numericOrNull(row.lat),
    lon: numericOrNull(row.lng),
    confidence: Number(row.confidence || 1),
    verification_count: Number(row.verification_count || 1),
    last_verified_at: row.last_verified_at
  };
}

function officialMunicipality(department, municipality) {
  return isBogota(department, municipality) ? 'BOGOTA D.C.' : municipality;
}

function isBogota(department, municipality) {
  const values = [normalizeText(department), normalizeText(municipality)];
  return values.some((value) => value === 'bogota' || value === 'bogota dc' || value === 'bogota d c' || value === 'bogota distrito capital');
}

function normalizeAddressKey(value) {
  return normalizeText(value)
    .replace(/\b(carrera|cra|cr)\b/g, 'kr')
    .replace(/\b(calle|cl)\b/g, 'cl')
    .replace(/\b(avenida|av)\b/g, 'av')
    .replace(/\b(numero|nro|no)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clean(value) {
  return String(value || '').trim();
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

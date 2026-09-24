const TOKEN_URL = 'https://visor.codigopostal.gov.co/472/visor/javascript/layout.aspx';
const ENTRY_URL = 'https://visor.codigopostal.gov.co/RestService472/CodigoPostal/EntryOrdinary';

let cachedToken = '';
let tokenExpiresAt = 0;

// El token del visor es temporal. Reutilizarlo evita una segunda petición en
// cada búsqueda y reduce la presión sobre el servicio oficial.

/**
 * Intenta resolver una direccion directamente desde el dispositivo del usuario.
 * En navegadores la politica CORS del proveedor puede impedir la llamada; en ese
 * caso retorna null y la UI debe usar el resolver local-first del backend.
 */
export async function resolveAddressFromDevice472({
  address,
  department,
  municipality,
  divipola,
  timeoutMs = 12000,
}) {
  if (!address || !department || !municipality || !divipola) return null;

  const token = await getDeviceToken(timeoutMs);
  if (!token) return null;

  try {
    const response = await fetchWithTimeout(ENTRY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
      },
      body: JSON.stringify({
        token,
        departamento: String(department).toUpperCase(),
        municipio: officialMunicipality(department, municipality),
        dvp: String(divipola).replace(/\D/g, '').padStart(5, '0'),
        direccion: String(address).replaceAll('"', "'"),
      }),
    }, timeoutMs);

    if (!response.ok) return null;
    const data = await response.json();
    if (String(data?.status) !== '200' || !data?.cp) return null;

    return {
      provider: 'official_472_device',
      postal_code: String(data.cp).trim(),
      expanded_postal_code: String(data.cp_ampliado || '').trim() || null,
      standard_address: String(data.direccion_estandar || address).trim(),
      lat: numberOrNull(data.lat),
      lon: numberOrNull(data.lon),
      wkid: data.wkid || null,
      raw: data,
    };
  } catch {
    return null;
  }
}

async function getDeviceToken(timeoutMs) {
  if (cachedToken && tokenExpiresAt > Date.now()) return cachedToken;

  try {
    const response = await fetchWithTimeout(TOKEN_URL, {
      method: 'GET',
      headers: { Accept: 'text/html,*/*' },
    }, timeoutMs);
    if (!response.ok) return '';

    const text = await response.text();
    const match = text.match(/userToken472\s*=\s*'([^']+)'/);
    if (!match?.[1]) return '';

    cachedToken = match[1];
    tokenExpiresAt = Date.now() + 55 * 60 * 1000;
    return cachedToken;
  } catch {
    return '';
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function officialMunicipality(department, municipality) {
  const normalized = `${department} ${municipality}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('bogota') ? 'BOGOTA D.C.' : String(municipality).toUpperCase();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

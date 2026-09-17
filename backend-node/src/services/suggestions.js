import { query } from '../db/postgres.js';
import { resolveRollingAddress } from './postal472.js';
import { getSite, reindexAllSites, slugify } from './sites.js';

const DEFAULT_CITY = 'Bogota';
const DEFAULT_DEPARTMENT = 'BOGOTA D.C.';
const DUPLICATE_RADIUS_METERS = 90;

export async function listSiteSuggestions({ status = 'pending', limit = 80 } = {}) {
  const result = await query(
    `
      SELECT
        ss.*,
        u.username,
        reviewer.username AS reviewer_username,
        duplicate.name AS duplicate_site_name,
        approved.name AS approved_site_name
      FROM site_suggestions ss
      LEFT JOIN users u ON u.id = ss.user_id
      LEFT JOIN users reviewer ON reviewer.id = ss.reviewed_by
      LEFT JOIN sites duplicate ON duplicate.id = ss.duplicate_site_id
      LEFT JOIN sites approved ON approved.id = ss.approved_site_id
      WHERE ($1 = 'all' OR ss.status = $1)
      ORDER BY ss.created_at DESC
      LIMIT $2
    `,
    [status, Math.min(Number(limit || 80), 160)]
  );

  return result.rows.map(toSuggestionDto);
}

export async function createSiteSuggestion({ item, user }) {
  const enriched = await enrichSuggestionLocation(item);
  const duplicates = await findNearbyDuplicates({
    name: enriched.nombre,
    lat: enriched.latitud,
    lng: enriched.longitud
  });

  const result = await query(
    `
      INSERT INTO site_suggestions(
        name, category, address, locality, city, department, divipola, postal_code,
        description, contact, user_id, suggested_by, lat, lng, duplicate_site_id
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *
    `,
    [
      enriched.nombre,
      enriched.categoria || 'Sitio local',
      enriched.direccion || null,
      enriched.localidad || null,
      enriched.ciudad || DEFAULT_CITY,
      enriched.departamento || null,
      enriched.divipola || null,
      enriched.codigo_postal || null,
      enriched.descripcion,
      enriched.contacto || null,
      user.id,
      enriched.suggested_by || user.username,
      enriched.latitud || null,
      enriched.longitud || null,
      duplicates[0]?.id || null
    ]
  );

  return {
    suggestion: toSuggestionDto(result.rows[0]),
    duplicates,
    address_resolution: enriched.address_resolution || null
  };
}

export async function previewSuggestionLocation(item) {
  const enriched = await enrichSuggestionLocation(item);
  const duplicates = await findNearbyDuplicates({
    name: enriched.nombre,
    lat: enriched.latitud,
    lng: enriched.longitud
  });
  return { suggestion: enriched, duplicates, address_resolution: enriched.address_resolution || null };
}

export async function approveSiteSuggestion({ suggestionId, moderator }) {
  const existing = await query('SELECT * FROM site_suggestions WHERE id = $1', [suggestionId]);
  const suggestion = existing.rows[0];
  if (!suggestion) return null;
  if (suggestion.status !== 'pending') throw new Error('La sugerencia ya fue revisada');
  if (!suggestion.lat || !suggestion.lng) throw new Error('La sugerencia no tiene coordenadas validas verificadas por Rolling/4-72');

  const duplicates = await findNearbyDuplicates({
    name: suggestion.name,
    lat: suggestion.lat,
    lng: suggestion.lng
  });
  if (duplicates.length > 0) {
    await query('UPDATE site_suggestions SET duplicate_site_id = $1 WHERE id = $2', [duplicates[0].id, suggestion.id]);
    throw new Error(`Posible duplicado: ${duplicates[0].nombre}`);
  }

  const neighborhoodId = await findOrCreateNeighborhood({
    name: suggestion.locality || suggestion.city || DEFAULT_CITY,
    locality: suggestion.locality || suggestion.city || DEFAULT_CITY,
    city: suggestion.city || DEFAULT_CITY
  });
  const slug = await uniqueSiteSlug(suggestion.name);

  const inserted = await query(
    `
      INSERT INTO sites(neighborhood_id, name, slug, category, address, description, phone, website, source, status, location)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'community','approved',ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography)
      RETURNING id
    `,
    [
      neighborhoodId,
      suggestion.name,
      slug,
      suggestion.category || 'Sitio local',
      suggestion.address,
      suggestion.description,
      normalizeContactPhone(suggestion.contact),
      normalizeContactWebsite(suggestion.contact),
      suggestion.lng,
      suggestion.lat
    ]
  );

  const site = await getSite(inserted.rows[0].id);
  await query(
    `
      UPDATE site_suggestions
      SET status = 'approved', approved_site_id = $1, reviewed_by = $2, reviewed_at = now()
      WHERE id = $3
    `,
    [site.id, moderator.id, suggestion.id]
  );
  await reindexAllSites();
  return site;
}

export async function rejectSiteSuggestion({ suggestionId, moderator, reason }) {
  const result = await query(
    `
      UPDATE site_suggestions
      SET status = 'rejected', reviewed_by = $1, reviewed_at = now(), rejection_reason = $2
      WHERE id = $3 AND status = 'pending'
      RETURNING *
    `,
    [moderator.id, String(reason || 'No cumple reglas de publicacion').slice(0, 500), suggestionId]
  );
  return result.rows[0] ? toSuggestionDto(result.rows[0]) : null;
}

export async function findNearbyDuplicates({ name, lat, lng, radius = DUPLICATE_RADIUS_METERS }) {
  if (!lat || !lng) return [];
  const result = await query(
    `
      SELECT
        s.id, s.name, s.category, s.address, s.rating_average,
        ST_Y(s.location::geometry) AS lat,
        ST_X(s.location::geometry) AS lng,
        ST_Distance(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) AS distance_meters,
        similarity(s.name, $3) AS name_similarity
      FROM sites s
      WHERE s.status = 'approved'
        AND ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $4)
      ORDER BY name_similarity DESC, distance_meters ASC
      LIMIT 8
    `,
    [Number(lng), Number(lat), name || '', Number(radius)]
  );

  return result.rows
    .filter((site) => Number(site.name_similarity) >= 0.18 || Number(site.distance_meters) <= 35)
    .map((site) => ({
      id: site.id,
      nombre: site.name,
      categoria: site.category,
      direccion: site.address,
      rating_promedio: Number(site.rating_average),
      latitud: Number(site.lat),
      longitud: Number(site.lng),
      distancia_metros: Math.round(Number(site.distance_meters)),
      similitud_nombre: Number(site.name_similarity)
    }));
}

async function enrichSuggestionLocation(item) {
  const candidate = { ...item };
  if (candidate.latitud && candidate.longitud) return candidate;
  if (!candidate.direccion) return candidate;

  const city = candidate.ciudad || DEFAULT_CITY;
  const department = candidate.departamento || (isBogota(city) ? DEFAULT_DEPARTMENT : '');
  const resolution = await resolveRollingAddress({
    address: candidate.direccion,
    department,
    municipality: city,
    divipola: candidate.divipola,
    allowLive: true
  });

  if (!resolution.found || !resolution.lat || !resolution.lon) {
    return { ...candidate, address_resolution: resolution };
  }

  return {
    ...candidate,
    direccion: resolution.standard_address || candidate.direccion,
    departamento: resolution.department || department,
    ciudad: resolution.municipality || city,
    divipola: resolution.divipola || candidate.divipola,
    codigo_postal: resolution.postal_code || null,
    latitud: Number(resolution.lat),
    longitud: Number(resolution.lon),
    address_resolution: resolution
  };
}

async function findOrCreateNeighborhood({ name, locality, city }) {
  const result = await query(
    `
      INSERT INTO neighborhoods(name, locality, city)
      VALUES($1, $2, $3)
      ON CONFLICT(name, locality, city) DO UPDATE SET city = EXCLUDED.city
      RETURNING id
    `,
    [name || locality || city || DEFAULT_CITY, locality || city || DEFAULT_CITY, city || DEFAULT_CITY]
  );
  return result.rows[0].id;
}

async function uniqueSiteSlug(name) {
  const base = slugify(name);
  for (let index = 0; index < 20; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const existing = await query('SELECT 1 FROM sites WHERE slug = $1', [slug]);
    if (!existing.rowCount) return slug;
  }
  return `${base}-${Date.now()}`;
}

function normalizeContactPhone(contact) {
  const value = String(contact || '').trim();
  if (!value || value.includes('http') || value.includes('@')) return null;
  return value.slice(0, 80);
}

function normalizeContactWebsite(contact) {
  const value = String(contact || '').trim();
  if (!value.startsWith('http')) return null;
  return value.slice(0, 180);
}

function isBogota(value) {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalized.includes('bogota');
}

function toSuggestionDto(row) {
  return {
    id: row.id,
    nombre: row.name,
    categoria: row.category,
    direccion: row.address,
    localidad: row.locality,
    ciudad: row.city,
    departamento: row.department,
    divipola: row.divipola,
    codigo_postal: row.postal_code,
    descripcion: row.description,
    contacto: row.contact,
    suggested_by: row.suggested_by || row.username,
    latitud: row.lat === null ? null : Number(row.lat),
    longitud: row.lng === null ? null : Number(row.lng),
    status: row.status,
    duplicate_site_id: row.duplicate_site_id,
    duplicate_site_name: row.duplicate_site_name,
    approved_site_id: row.approved_site_id,
    approved_site_name: row.approved_site_name,
    reviewed_by: row.reviewer_username,
    reviewed_at: row.reviewed_at,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at
  };
}

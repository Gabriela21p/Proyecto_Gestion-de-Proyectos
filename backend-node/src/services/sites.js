import { query } from '../db/postgres.js';
import { indexSites } from './search.js';

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'sitio';
}

export async function listSites(filters = {}) {
  const values = [];
  const where = ['s.status = $1'];
  values.push('approved');

  if (filters.localidad) {
    values.push(`%${filters.localidad}%`);
    where.push(`(n.locality ILIKE $${values.length} OR n.city ILIKE $${values.length})`);
  }
  if (filters.activity) {
    values.push(`%${filters.activity}%`);
    where.push(`EXISTS (
      SELECT 1 FROM site_activities sa
      JOIN activities a ON a.id = sa.activity_id
      WHERE sa.site_id = s.id AND a.name ILIKE $${values.length}
    )`);
  }
  if (filters.category) {
    values.push(`%${filters.category}%`);
    where.push(`s.category ILIKE $${values.length}`);
  }
  if (filters.min_rating) {
    values.push(Number(filters.min_rating));
    where.push(`s.rating_average >= $${values.length}`);
  }
  if (filters.has_events === 'true' || filters.has_events === true) {
    where.push('s.active_event_count > 0');
  }
  if (filters.q) {
    values.push(`%${filters.q}%`);
    where.push(`(s.name ILIKE $${values.length} OR s.description ILIKE $${values.length} OR s.category ILIKE $${values.length})`);
  }
  if (filters.lat && filters.lng && filters.radius) {
    values.push(Number(filters.lng), Number(filters.lat), Number(filters.radius));
    where.push(`ST_DWithin(s.location, ST_SetSRID(ST_MakePoint($${values.length - 2}, $${values.length - 1}), 4326)::geography, $${values.length})`);
  }

  const order = filters.sort === 'rating'
    ? 's.rating_average DESC, s.review_count DESC'
    : filters.sort === 'events'
      ? 's.active_event_count DESC, s.trust_score DESC'
      : 's.featured DESC, s.trust_score DESC, s.rating_average DESC';

  const limit = Math.min(Number(filters.limit || 60), 120);
  values.push(limit);

  const result = await query(
    `
      SELECT
        s.*,
        ST_Y(s.location::geometry) AS lat,
        ST_X(s.location::geometry) AS lng,
        n.name AS neighborhood_name,
        n.locality,
        n.city,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', a.id, 'nombre', a.name, 'icono', a.icon)) FILTER (WHERE a.id IS NOT NULL), '[]') AS activities
      FROM sites s
      LEFT JOIN neighborhoods n ON n.id = s.neighborhood_id
      LEFT JOIN site_activities sa ON sa.site_id = s.id
      LEFT JOIN activities a ON a.id = sa.activity_id
      WHERE ${where.join(' AND ')}
      GROUP BY s.id, n.id
      ORDER BY ${order}
      LIMIT $${values.length}
    `,
    values
  );

  return result.rows.map(toSiteDto);
}

export async function getSite(id) {
  const result = await query(
    `
      SELECT
        s.*,
        ST_Y(s.location::geometry) AS lat,
        ST_X(s.location::geometry) AS lng,
        n.name AS neighborhood_name,
        n.locality,
        n.city,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', a.id, 'nombre', a.name, 'icono', a.icon)) FILTER (WHERE a.id IS NOT NULL), '[]') AS activities
      FROM sites s
      LEFT JOIN neighborhoods n ON n.id = s.neighborhood_id
      LEFT JOIN site_activities sa ON sa.site_id = s.id
      LEFT JOIN activities a ON a.id = sa.activity_id
      WHERE s.id = $1 AND s.status = 'approved'
      GROUP BY s.id, n.id
    `,
    [id]
  );
  if (!result.rowCount) return null;

  const site = toSiteDto(result.rows[0]);
  const reviews = await query(
    `
      SELECT r.*, u.username, u.role, u.reputation
      FROM reviews r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.site_id = $1 AND r.status = 'published'
      ORDER BY r.created_at DESC
      LIMIT 30
    `,
    [id]
  );
  const events = await query(
    `
      SELECT *
      FROM events
      WHERE site_id = $1 AND status = 'approved'
      ORDER BY starts_on ASC
      LIMIT 20
    `,
    [id]
  );

  return {
    ...site,
    reviews: reviews.rows.map(toReviewDto),
    events: events.rows.map(toEventDto)
  };
}

export async function createReviewForUser({ siteId, user, rating, title, body, verified = false }) {
  const weight = calculateReviewWeight(user, verified);
  const result = await query(
    `
      INSERT INTO reviews(site_id, user_id, rating, title, body, verified, weight)
      VALUES($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    [siteId, user.id, rating, title || null, body, verified, weight]
  );
  await refreshSiteMetrics(siteId);
  return toReviewDto({ ...result.rows[0], username: user.username, role: user.role, reputation: user.reputation });
}

export async function refreshSiteMetrics(siteId) {
  await query(
    `
      UPDATE sites s
      SET
        rating_average = COALESCE(agg.avg_rating, 0),
        review_count = COALESCE(agg.review_count, 0),
        verified_review_count = COALESCE(agg.verified_count, 0),
        active_event_count = COALESCE(ev.event_count, 0),
        trust_score = ROUND(
          (COALESCE(agg.avg_rating, 0) * 18)
          + LEAST(COALESCE(agg.review_count, 0), 50)
          + (COALESCE(agg.verified_count, 0) * 2)
          + (COALESCE(ev.event_count, 0) * 4),
          2
        ),
        featured = COALESCE(agg.avg_rating, 0) >= 4.5 AND COALESCE(agg.review_count, 0) >= 2,
        updated_at = now()
      FROM
        (
          SELECT site_id, COUNT(*)::INTEGER AS review_count,
                 (SUM(rating * weight) / NULLIF(SUM(weight), 0))::NUMERIC(3,2) AS avg_rating,
                 SUM(CASE WHEN verified THEN 1 ELSE 0 END)::INTEGER AS verified_count
          FROM reviews
          WHERE site_id = $1 AND status = 'published'
          GROUP BY site_id
        ) agg
      FULL OUTER JOIN
        (
          SELECT site_id, COUNT(*)::INTEGER AS event_count
          FROM events
          WHERE site_id = $1 AND status = 'approved' AND ends_on >= CURRENT_DATE
          GROUP BY site_id
        ) ev
      ON agg.site_id = ev.site_id
      WHERE s.id = $1
    `,
    [siteId]
  );
}

export async function reindexAllSites() {
  const sites = await listSites({ limit: 120 });
  await indexSites(sites.map((site) => ({
    id: site.id,
    name: site.nombre,
    category: site.categoria,
    description: site.descripcion,
    address: site.direccion,
    locality: site.barrio?.localidad,
    city: site.barrio?.ciudad,
    activities: site.activities.map((activity) => activity.nombre),
    hasEvents: site.active_events_count > 0,
    rating_average: site.rating_promedio,
    trust_score: site.trust_score,
    review_count: site.total_reviews,
    active_event_count: site.active_events_count
  })));
}

export function calculateReviewWeight(user, verifiedVisit = false) {
  const base = Number(user.review_weight || 1);
  const identityBoost = user.email_verified ? 0.35 : 0;
  const roleBoost = user.role === 'moderator' || user.role === 'admin' ? 0.4 : 0;
  const reputationBoost = Math.min(Number(user.reputation || 0) / 100, 0.5);
  const visitBoost = verifiedVisit ? 0.3 : 0;
  return Math.min(2.5, Number((base + identityBoost + roleBoost + reputationBoost + visitBoost).toFixed(2)));
}

export function toSiteDto(row) {
  return {
    id: row.id,
    nombre: row.name,
    slug: row.slug,
    categoria: row.category,
    direccion: row.address,
    descripcion: row.description,
    rango_precio: row.price_range,
    telefono: row.phone,
    website: row.website,
    imagen_url: row.image_url,
    latitud: Number(row.lat),
    longitud: Number(row.lng),
    status: row.status,
    destacado: row.featured,
    rating_promedio: Number(row.rating_average),
    total_reviews: row.review_count,
    total_reviews_verificadas: row.verified_review_count,
    active_events_count: row.active_event_count,
    trust_score: Number(row.trust_score),
    barrio: {
      id: row.neighborhood_id,
      nombre: row.neighborhood_name,
      localidad: row.locality,
      ciudad: row.city
    },
    activities: typeof row.activities === 'string' ? JSON.parse(row.activities) : row.activities
  };
}

export function toReviewDto(row) {
  return {
    id: row.id,
    sitio_id: row.site_id,
    rating: row.rating,
    titulo: row.title,
    comentario: row.body,
    verificada: row.verified,
    weight: Number(row.weight || 1),
    fecha_creacion: row.created_at,
    user: row.username
      ? { username: row.username, role: row.role, reputation: row.reputation }
      : null
  };
}

export function toEventDto(row) {
  return {
    id: row.id,
    sitio_id: row.site_id,
    titulo: row.title,
    descripcion: row.description,
    fecha_inicio: row.starts_on,
    fecha_fin: row.ends_on,
    hora: row.time_label,
    costo: row.cost_label,
    status: row.status
  };
}

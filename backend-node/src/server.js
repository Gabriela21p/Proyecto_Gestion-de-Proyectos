import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import mercurius from 'mercurius';
import { Server as SocketServer } from 'socket.io';
import { z } from 'zod';
import os from 'node:os';

// Este archivo es el punto de encuentro de la API: registra transportes y rutas,
// mientras las reglas de negocio permanecen en services para poder probarlas aparte.
import { config } from './config.js';
import { initPostgres, query, closePostgres } from './db/postgres.js';
import { initMongo, mongoDb, closeMongo } from './db/mongo.js';
import { seedDatabase } from './db/seed.js';
import { initSearch, searchSites } from './services/search.js';
import { notificationsQueue, searchQueue, startWorkers, redis } from './services/queues.js';
import { geocode, nearbyOsmBusinesses } from './services/osm.js';
import { createReviewForUser, getSite, listSites, refreshSiteMetrics } from './services/sites.js';
import { loginUser, registerUser, requireRole, requireUser, toAuthUser } from './services/auth.js';
import {
  approveSiteSuggestion,
  createSiteSuggestion,
  listSiteSuggestions,
  previewSuggestionLocation,
  rejectSiteSuggestion
} from './services/suggestions.js';

const app = Fastify({ logger: true });

await app.register(helmet);
await app.register(cors, { origin: [config.frontendOrigin, 'http://localhost:3000'], credentials: true });
await app.register(rateLimit, { max: 240, timeWindow: '1 minute' });
await app.register(swagger, {
  transform: ({ schema = {}, url }) => {
    const tag = getDocumentationTag(url);
    return {
      schema: tag && !schema.tags ? { ...schema, tags: [tag] } : schema,
      url
    };
  },
  swagger: {
    info: {
      title: 'Rolling API',
      version: '0.1.0',
      description: 'API REST de Rolling, organizada por capas funcionales.'
    },
    tags: [
      { name: 'Plataforma', description: 'Estado y puntos de entrada del servicio.' },
      { name: 'Identidad', description: 'Registro, inicio de sesión y sesión actual.' },
      { name: 'Catálogos', description: 'Datos base para inicializar clientes y filtros.' },
      { name: 'Administración', description: 'Analítica y gestión de usuarios con permisos elevados.' },
      { name: 'Sitios y reputación', description: 'Consulta de sitios, reseñas y reportes.' },
      { name: 'Eventos', description: 'Agenda de eventos aprobados.' },
      { name: 'Sugerencias y moderación', description: 'Propuestas de nuevos sitios y su revisión.' },
      { name: 'Descubrimiento geográfico', description: 'Búsqueda, geocodificación e importación desde OpenStreetMap.' },
      { name: 'Comunidad', description: 'Publicaciones del feed comunitario.' }
    ]
  }
});
await app.register(swaggerUi, { routePrefix: '/docs' });

await app.register(mercurius, {
  schema: `
    type Barrio { id: ID, nombre: String, localidad: String, ciudad: String }
    type Activity { id: ID, nombre: String, icono: String }
    type Site {
      id: ID!, nombre: String!, categoria: String, direccion: String, descripcion: String,
      latitud: Float, longitud: Float, rating_promedio: Float, total_reviews: Int,
      trust_score: Float, active_events_count: Int, barrio: Barrio, activities: [Activity]
    }
    type Query {
      sites(q: String, localidad: String, activity: String): [Site]
      site(id: ID!): Site
    }
  `,
  resolvers: {
    Query: {
      sites: async (_, args) => listSites(args),
      site: async (_, { id }) => getSite(id)
    }
  },
  graphiql: true
});

const io = new SocketServer(app.server, {
  cors: { origin: config.frontendOrigin }
});

io.on('connection', (socket) => {
  socket.emit('rolling:connected', { ok: true, at: new Date().toISOString() });
});

const reviewSchema = z.object({
  username: z.string().min(1).max(50).optional(),
  rating: z.number().int().min(1).max(5),
  titulo: z.string().max(120).optional(),
  comentario: z.string().min(12).max(1200),
  verificada: z.boolean().optional()
});

const suggestionSchema = z.object({
  nombre: z.string().min(3).max(120),
  categoria: z.string().max(60).optional(),
  direccion: z.string().max(180).optional(),
  localidad: z.string().max(100).optional(),
  ciudad: z.string().max(100).optional(),
  descripcion: z.string().min(10).max(1200),
  contacto: z.string().max(120).optional(),
  suggested_by: z.string().max(120).optional(),
  latitud: z.number().optional(),
  longitud: z.number().optional()
});

const authSchema = z.object({
  username: z.string().min(2).max(50).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(120)
});

const moderationSchema = z.object({
  reason: z.string().max(500).optional()
});

const userRoleSchema = z.object({
  role: z.enum(['neighbor', 'moderator', 'admin'])
});

app.get('/', async () => ({
  app: 'Rolling API',
  status: 'ok',
  docs: '/docs',
  graphql: '/graphql',
  health: '/api/health',
  frontend: config.frontendOrigin
}));

app.get('/favicon.ico', async (_request, reply) => reply.code(204).send());
app.get('/health', async () => ({ status: 'ok', service: 'rolling-fastify-api', version: 'mvp-node-1' }));
app.get('/api/health', async () => ({ status: 'ok', service: 'rolling-fastify-api', version: 'mvp-node-1' }));

app.post('/api/auth/register', async (request, reply) => {
  const parsed = authSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
  try {
    const user = await registerUser(parsed.data);
    const session = await loginUser({ email: parsed.data.email, password: parsed.data.password });
    return reply.code(201).send({ user: toAuthUser(user), token: session.token });
  } catch (error) {
    return reply.code(400).send({ error: error.message });
  }
});

app.post('/api/auth/login', async (request, reply) => {
  const parsed = authSchema.pick({ email: true, password: true }).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
  try {
    return await loginUser(parsed.data);
  } catch (error) {
    return reply.code(401).send({ error: error.message });
  }
});

app.get('/api/auth/me', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return null;
  return { user: toAuthUser(user) };
});

app.get('/api/bootstrap', async () => ({
  stats: await buildStats(),
  neighborhoods: await listNeighborhoods(),
  activities: await listActivities(),
  architecture: buildArchitecture()
}));

app.get('/api/stats', buildStats);
app.get('/api/neighborhoods', listNeighborhoods);
app.get('/api/activities', listActivities);

app.get('/api/admin/dashboard', async (request, reply) => {
  const admin = await requireRole(request, reply, ['admin', 'moderator']);
  if (!admin) return null;
  return buildAdminDashboard(request.query);
});

app.get('/api/admin/users', async (request, reply) => {
  const admin = await requireRole(request, reply, ['admin']);
  if (!admin) return null;
  const filters = normalizeUserFilters(request.query);
  const result = await query(
    `
      SELECT id, username, email, role, reputation, email_verified, identity_level, review_weight, created_at, updated_at
      FROM users
      WHERE ($1::text = '' OR role = $1::text)
        AND ($2::text = '' OR identity_level = $2::text)
        AND ($3::text = '' OR email_verified = ($3::text = 'true'))
        AND (
          $4::text = ''
          OR username ILIKE $4::text
          OR email ILIKE $4::text
        )
      ORDER BY
        CASE role WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT 200
    `,
    [filters.role, filters.identity_level, filters.email_verified, filters.q ? `%${filters.q}%` : '']
  );
  return result.rows.map(toAdminUserDto);
});

app.patch('/api/admin/users/:id/role', async (request, reply) => {
  const admin = await requireRole(request, reply, ['admin']);
  if (!admin) return null;
  const parsed = userRoleSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

  if (request.params.id === admin.id && parsed.data.role !== 'admin') {
    const count = await query("SELECT COUNT(*)::INTEGER AS total FROM users WHERE role = 'admin'");
    if (count.rows[0].total <= 1) {
      return reply.code(409).send({ error: 'No puedes degradar el ultimo admin' });
    }
  }

  const result = await query(
    `
      UPDATE users
      SET role = $1,
          review_weight = CASE
            WHEN $1 = 'admin' THEN GREATEST(review_weight, 1.8)
            WHEN $1 = 'moderator' THEN GREATEST(review_weight, 1.5)
            ELSE LEAST(review_weight, 1.35)
          END,
          updated_at = now()
      WHERE id = $2
      RETURNING id, username, email, role, reputation, email_verified, identity_level, review_weight, created_at, updated_at
    `,
    [parsed.data.role, request.params.id]
  );
  if (!result.rowCount) return reply.code(404).send({ error: 'Usuario no encontrado' });
  return { user: toAdminUserDto(result.rows[0]) };
});

app.get('/api/sites', async (request) => listSites(request.query));

app.get('/api/sites/:id', async (request, reply) => {
  const site = await getSite(request.params.id);
  if (!site) return reply.code(404).send({ error: 'Sitio no encontrado' });
  return site;
});

app.post('/api/sites/:id/reviews', async (request, reply) => {
  const parsed = reviewSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

  const authUser = await requireUser(request, reply);
  if (!authUser) return null;
  const review = await createReviewForUser({
    siteId: request.params.id,
    user: authUser,
    rating: parsed.data.rating,
    title: parsed.data.titulo,
    body: parsed.data.comentario,
    verified: parsed.data.verificada
  });
  const site = await getSite(request.params.id);
  await mongoDb().collection('feed_posts').insertOne({
    siteId: request.params.id,
    type: 'review',
    title: review.titulo || `Nueva review en ${site?.nombre || 'Rolling'}`,
    body: review.comentario,
    rating: review.rating,
    createdAt: new Date()
  });
  await searchQueue.add('reindex-sites', { siteId: request.params.id });
  await notificationsQueue.add('review:created', { review, site });
  return reply.code(201).send({ review, sitio: site });
});

app.post('/api/sites/:id/reports', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const reason = String(request.body?.reason || '').slice(0, 80);
  const detail = String(request.body?.detail || '').slice(0, 1000);
  if (!reason) return reply.code(400).send({ error: 'Debes indicar una razon' });

  const result = await query(
    'INSERT INTO reports(site_id, user_id, reason, detail) VALUES($1, $2, $3, $4) RETURNING *',
    [request.params.id, user.id, reason, detail]
  );
  await notificationsQueue.add('report:created', result.rows[0]);
  return reply.code(201).send({ report: result.rows[0] });
});

app.get('/api/events', async (request) => {
  const limit = Math.min(Number(request.query.limit || 30), 80);
  const result = await query(
    `
      SELECT e.*, s.name AS site_name
      FROM events e
      JOIN sites s ON s.id = e.site_id
      WHERE e.status = 'approved' AND e.ends_on >= CURRENT_DATE AND s.status = 'approved'
      ORDER BY e.starts_on ASC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows;
});

app.get('/api/site-suggestions', async (request, reply) => {
  const moderator = await requireRole(request, reply, ['admin', 'moderator']);
  if (!moderator) return null;
  return listSiteSuggestions(request.query);
});

app.post('/api/site-suggestions/preview', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const parsed = suggestionSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
  return previewSuggestionLocation(parsed.data);
});

app.post('/api/site-suggestions', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const parsed = suggestionSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
  const result = await createSiteSuggestion({ item: parsed.data, user });
  await notificationsQueue.add('suggestion:created', result.suggestion);
  return reply.code(201).send(result);
});

app.post('/api/site-suggestions/:id/approve', async (request, reply) => {
  const moderator = await requireRole(request, reply, ['admin', 'moderator']);
  if (!moderator) return null;
  try {
    const site = await approveSiteSuggestion({ suggestionId: request.params.id, moderator });
    if (!site) return reply.code(404).send({ error: 'Sugerencia no encontrada' });
    await searchQueue.add('reindex-sites', { siteId: site.id });
    await notificationsQueue.add('suggestion:approved', { site, suggestionId: request.params.id });
    return reply.code(201).send({ site });
  } catch (error) {
    return reply.code(409).send({ error: error.message });
  }
});

app.post('/api/site-suggestions/:id/reject', async (request, reply) => {
  const moderator = await requireRole(request, reply, ['admin', 'moderator']);
  if (!moderator) return null;
  const parsed = moderationSchema.safeParse(request.body || {});
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
  const suggestion = await rejectSiteSuggestion({
    suggestionId: request.params.id,
    moderator,
    reason: parsed.data.reason
  });
  if (!suggestion) return reply.code(404).send({ error: 'Sugerencia no encontrada o ya revisada' });
  await notificationsQueue.add('suggestion:rejected', suggestion);
  return { suggestion };
});

app.get('/api/search', async (request) => searchSites(request.query.q || '', request.query));
app.get('/api/osm/geocode', async (request) => geocode(request.query.q || ''));
app.get('/api/osm/nearby', async (request) => nearbyOsmBusinesses({
  lat: Number(request.query.lat),
  lng: Number(request.query.lng),
  radius: Number(request.query.radius || 700)
}));

app.post('/api/osm/import-nearby', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const lat = Number(request.body?.lat);
  const lng = Number(request.body?.lng);
  const radius = Math.min(Number(request.body?.radius || 700), 2000);
  if (!lat || !lng) return reply.code(400).send({ error: 'lat y lng son obligatorios' });

  const elements = await nearbyOsmBusinesses({ lat, lng, radius });
  const imported = [];
  for (const element of elements.slice(0, 40)) {
    const tags = element.tags || {};
    const name = tags.name || tags.brand;
    if (!name) continue;

    const category = tags.amenity || tags.shop || tags.tourism || 'osm';
    const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
    const result = await query(
      `
        INSERT INTO site_suggestions(name, category, address, locality, city, description, contact, user_id, suggested_by, lat, lng, status)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,'overpass-osm',$9,$10,'pending')
        ON CONFLICT DO NOTHING
        RETURNING *
      `,
      [
        name,
        category,
        address || null,
        tags['addr:suburb'] || null,
        tags['addr:city'] || null,
        `Importado desde OpenStreetMap. osm_id=${element.id}`,
        tags.phone || tags.website || null,
        user.id,
        element.lat || element.center?.lat,
        element.lon || element.center?.lon
      ]
    );
    if (result.rowCount) imported.push(result.rows[0]);
  }

  await notificationsQueue.add('osm:imported', { count: imported.length, lat, lng, radius });
  return { imported_count: imported.length, suggestions: imported };
});

app.get('/api/feed', async () => {
  return mongoDb().collection('feed_posts').find({}).sort({ createdAt: -1 }).limit(40).toArray();
});

app.post('/api/feed', async (request, reply) => {
  const user = await requireUser(request, reply);
  if (!user) return null;
  const post = {
    siteId: request.body?.siteId || null,
    type: request.body?.type || 'community',
    title: String(request.body?.title || '').slice(0, 140),
    body: String(request.body?.body || '').slice(0, 1600),
    authorId: user.id,
    authorUsername: user.username,
    createdAt: new Date()
  };
  const result = await mongoDb().collection('feed_posts').insertOne(post);
  const saved = { ...post, _id: result.insertedId };
  await notificationsQueue.add('feed:created', saved);
  return reply.code(201).send(saved);
});

async function listNeighborhoods() {
  const result = await query('SELECT id, name AS nombre, locality AS localidad, city AS ciudad FROM neighborhoods ORDER BY city, locality, name');
  return result.rows;
}

async function listActivities() {
  const result = await query('SELECT id, name AS nombre, icon AS icono FROM activities ORDER BY name');
  return result.rows;
}

async function buildStats() {
  const result = await query(`
    SELECT
      (SELECT COUNT(*)::INTEGER FROM sites WHERE status = 'approved') AS sitios,
      (SELECT COUNT(*)::INTEGER FROM reviews WHERE status = 'published') AS reviews,
      (SELECT COUNT(DISTINCT locality)::INTEGER FROM neighborhoods) AS localidades,
      (SELECT COUNT(*)::INTEGER FROM events WHERE status = 'approved' AND ends_on >= CURRENT_DATE) AS eventos_activos,
      (SELECT COUNT(*)::INTEGER FROM site_suggestions WHERE status = 'pending') AS sugerencias_pendientes,
      (SELECT COALESCE(ROUND(AVG(rating_average), 1), 0) FROM sites WHERE status = 'approved') AS rating_promedio
  `);
  return result.rows[0];
}

async function buildAdminDashboard(rawFilters = {}) {
  const filters = normalizeDashboardFilters(rawFilters);
  const sqlFilters = [
    filters.from || null,
    filters.to || null,
    filters.localidad ? `%${filters.localidad}%` : '',
    filters.ciudad ? `%${filters.ciudad}%` : '',
    filters.categoria ? `%${filters.categoria}%` : ''
  ];
  const dateFilters = sqlFilters.slice(0, 2);

  const filteredSitesCte = `
    SELECT s.*, n.locality, n.city
    FROM sites s
    LEFT JOIN neighborhoods n ON n.id = s.neighborhood_id
    WHERE s.status = 'approved'
      AND ($1::date IS NULL OR s.created_at >= $1::date)
      AND ($2::date IS NULL OR s.created_at < $2::date + interval '1 day')
      AND ($3::text = '' OR n.locality ILIKE $3::text)
      AND ($4::text = '' OR n.city ILIKE $4::text)
      AND ($5::text = '' OR s.category ILIKE $5::text)
  `;

  const scopedSitesCte = `
    SELECT s.*, n.locality, n.city
    FROM sites s
    LEFT JOIN neighborhoods n ON n.id = s.neighborhood_id
    WHERE s.status = 'approved'
      AND ($3::text = '' OR n.locality ILIKE $3::text)
      AND ($4::text = '' OR n.city ILIKE $4::text)
      AND ($5::text = '' OR s.category ILIKE $5::text)
  `;

  const [relational, monthly, roles, suggestionStatuses, topLocalities, topCategories] = await Promise.all([
    query(`
      WITH filtered_sites AS (
        ${filteredSitesCte}
      ),
      filtered_reviews AS (
        SELECT r.*
        FROM reviews r
        JOIN filtered_sites fs ON fs.id = r.site_id
        WHERE r.status = 'published'
          AND ($1::date IS NULL OR r.created_at >= $1::date)
          AND ($2::date IS NULL OR r.created_at < $2::date + interval '1 day')
      ),
      filtered_suggestions AS (
        SELECT ss.*
        FROM site_suggestions ss
        WHERE ($1::date IS NULL OR ss.created_at >= $1::date)
          AND ($2::date IS NULL OR ss.created_at < $2::date + interval '1 day')
          AND ($3::text = '' OR ss.locality ILIKE $3::text)
          AND ($4::text = '' OR ss.city ILIKE $4::text)
          AND ($5::text = '' OR ss.category ILIKE $5::text)
      ),
      filtered_reports AS (
        SELECT rp.*
        FROM reports rp
        LEFT JOIN filtered_sites fs ON fs.id = rp.site_id
        WHERE ($1::date IS NULL OR rp.created_at >= $1::date)
          AND ($2::date IS NULL OR rp.created_at < $2::date + interval '1 day')
          AND (rp.site_id IS NULL OR fs.id IS NOT NULL)
      ),
      filtered_users AS (
        SELECT u.*
        FROM users u
        WHERE ($1::date IS NULL OR u.created_at >= $1::date)
          AND ($2::date IS NULL OR u.created_at < $2::date + interval '1 day')
      )
      SELECT
        (SELECT COUNT(*)::INTEGER FROM filtered_users) AS usuarios,
        (SELECT COUNT(*)::INTEGER FROM filtered_users WHERE role = 'admin') AS admins,
        (SELECT COUNT(*)::INTEGER FROM filtered_users WHERE role = 'moderator') AS moderadores,
        (SELECT COUNT(*)::INTEGER FROM filtered_sites) AS sitios,
        (SELECT COUNT(*)::INTEGER FROM filtered_reviews) AS reviews,
        (SELECT COUNT(*)::INTEGER FROM filtered_reports WHERE status = 'open') AS reportes_abiertos,
        (SELECT COUNT(*)::INTEGER FROM filtered_suggestions WHERE status = 'pending') AS sugerencias_pendientes,
        (SELECT COUNT(*)::INTEGER FROM filtered_suggestions WHERE status = 'approved') AS sugerencias_aprobadas,
        (SELECT COUNT(*)::INTEGER FROM filtered_suggestions WHERE status = 'rejected') AS sugerencias_rechazadas,
        (SELECT COUNT(*)::INTEGER FROM events e JOIN filtered_sites fs ON fs.id = e.site_id WHERE e.status = 'approved' AND e.ends_on >= CURRENT_DATE) AS eventos_activos,
        (SELECT COALESCE(ROUND(AVG(rating_average), 2), 0) FROM filtered_sites) AS rating_promedio,
        (SELECT COALESCE(ROUND(AVG(trust_score), 2), 0) FROM filtered_sites) AS confianza_promedio
    `, sqlFilters),
    query(`
      WITH bounds AS (
        SELECT
          COALESCE(date_trunc('month', $1::date), date_trunc('month', CURRENT_DATE) - interval '5 months') AS start_month,
          COALESCE(date_trunc('month', $2::date), date_trunc('month', CURRENT_DATE)) AS end_month
      ),
      months AS (
        SELECT generate_series(bounds.start_month, bounds.end_month, interval '1 month') AS month
        FROM bounds
      ),
      scoped_sites AS (
        ${scopedSitesCte}
      )
      SELECT
        to_char(months.month, 'YYYY-MM') AS month,
        (SELECT COUNT(*)::INTEGER FROM users u WHERE u.created_at >= months.month AND u.created_at < months.month + interval '1 month') AS users,
        (SELECT COUNT(*)::INTEGER FROM scoped_sites fs WHERE fs.created_at >= months.month AND fs.created_at < months.month + interval '1 month') AS sites,
        (SELECT COUNT(*)::INTEGER FROM reviews r JOIN scoped_sites fs ON fs.id = r.site_id WHERE r.created_at >= months.month AND r.created_at < months.month + interval '1 month' AND r.status = 'published') AS reviews,
        (SELECT COUNT(*)::INTEGER FROM site_suggestions ss WHERE ss.created_at >= months.month AND ss.created_at < months.month + interval '1 month'
          AND ($3::text = '' OR ss.locality ILIKE $3::text)
          AND ($4::text = '' OR ss.city ILIKE $4::text)
          AND ($5::text = '' OR ss.category ILIKE $5::text)) AS suggestions,
        (SELECT COUNT(*)::INTEGER FROM reports rp LEFT JOIN scoped_sites fs ON fs.id = rp.site_id WHERE rp.created_at >= months.month AND rp.created_at < months.month + interval '1 month' AND (rp.site_id IS NULL OR fs.id IS NOT NULL)) AS reports
      FROM months
      ORDER BY months.month
    `, sqlFilters),
    query(`
      SELECT role, COUNT(*)::INTEGER AS total
      FROM users u
      WHERE ($1::date IS NULL OR u.created_at >= $1::date)
        AND ($2::date IS NULL OR u.created_at < $2::date + interval '1 day')
      GROUP BY role
      ORDER BY total DESC
    `, dateFilters),
    query(`
      SELECT status, COUNT(*)::INTEGER AS total
      FROM site_suggestions ss
      WHERE ($1::date IS NULL OR ss.created_at >= $1::date)
        AND ($2::date IS NULL OR ss.created_at < $2::date + interval '1 day')
        AND ($3::text = '' OR ss.locality ILIKE $3::text)
        AND ($4::text = '' OR ss.city ILIKE $4::text)
        AND ($5::text = '' OR ss.category ILIKE $5::text)
      GROUP BY status
      ORDER BY total DESC
    `, sqlFilters),
    query(`
      SELECT fs.locality, COUNT(*)::INTEGER AS total, ROUND(AVG(fs.rating_average), 2) AS rating
      FROM (
        ${filteredSitesCte}
      ) fs
      GROUP BY fs.locality
      ORDER BY total DESC, rating DESC
      LIMIT 8
    `, sqlFilters),
    query(`
      SELECT fs.category, COUNT(*)::INTEGER AS total, ROUND(AVG(fs.rating_average), 2) AS rating
      FROM (
        ${filteredSitesCte}
      ) fs
      GROUP BY fs.category
      ORDER BY total DESC, rating DESC
      LIMIT 8
    `, sqlFilters)
  ]);
  const feedQuery = {};
  if (filters.from || filters.to) {
    feedQuery.createdAt = {};
    if (filters.from) feedQuery.createdAt.$gte = new Date(filters.from);
    if (filters.to) {
      const endDate = new Date(filters.to);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      feedQuery.createdAt.$lt = endDate;
    }
  }
  const feedPosts = await mongoDb().collection('feed_posts').countDocuments(feedQuery);
  const memory = process.memoryUsage();
  const cpus = os.cpus();

  return {
    ...relational.rows[0],
    feed_posts: feedPosts,
    monthly: monthly.rows,
    roles: roles.rows,
    suggestion_statuses: suggestionStatuses.rows,
    top_localities: topLocalities.rows.map((item) => ({
      locality: item.locality || 'Sin localidad',
      total: item.total,
      rating: Number(item.rating || 0)
    })),
    top_categories: topCategories.rows.map((item) => ({
      category: item.category || 'Sin categoria',
      total: item.total,
      rating: Number(item.rating || 0)
    })),
    filters,
    recursos: {
      api_uptime_seconds: Math.round(process.uptime()),
      memory_rss_mb: Math.round(memory.rss / 1024 / 1024),
      memory_heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
      memory_heap_total_mb: Math.round(memory.heapTotal / 1024 / 1024),
      cpu_count: cpus.length,
      load_average_1m: Number(os.loadavg()[0].toFixed(2)),
      platform: os.platform()
    },
    servicios: {
      api: 'ok',
      postgres_postgis: 'ok',
      mongodb: 'ok',
      redis_bullmq: redis.status === 'ready' ? 'ok' : redis.status,
      meilisearch: 'ok'
    }
  };
}

function toAdminUserDto(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    reputation: user.reputation,
    email_verified: user.email_verified,
    identity_level: user.identity_level,
    review_weight: Number(user.review_weight || 1),
    created_at: user.created_at,
    updated_at: user.updated_at
  };
}

function normalizeDashboardFilters(queryParams = {}) {
  const from = parseDateFilter(queryParams.from);
  const to = parseDateFilter(queryParams.to);
  return {
    from,
    to,
    localidad: cleanFilter(queryParams.localidad),
    ciudad: cleanFilter(queryParams.ciudad),
    categoria: cleanFilter(queryParams.categoria)
  };
}

function normalizeUserFilters(queryParams = {}) {
  const role = cleanFilter(queryParams.role);
  const identityLevel = cleanFilter(queryParams.identity_level);
  const verified = cleanFilter(queryParams.email_verified);
  return {
    role: ['neighbor', 'moderator', 'admin'].includes(role) ? role : '',
    identity_level: ['guest', 'registered', 'verified', 'trusted'].includes(identityLevel) ? identityLevel : '',
    email_verified: ['true', 'false'].includes(verified) ? verified : '',
    q: cleanFilter(queryParams.q)
  };
}

function parseDateFilter(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  return raw;
}

function cleanFilter(value) {
  return String(value || '').trim().slice(0, 80);
}

function getDocumentationTag(url) {
  if (url === '/' || url === '/health' || url === '/api/health') return 'Plataforma';
  if (url.startsWith('/api/auth')) return 'Identidad';
  if (url === '/api/bootstrap' || url === '/api/stats' || url === '/api/neighborhoods' || url === '/api/activities') return 'Catálogos';
  if (url.startsWith('/api/admin')) return 'Administración';
  if (url.startsWith('/api/sites')) return 'Sitios y reputación';
  if (url === '/api/events') return 'Eventos';
  if (url.startsWith('/api/site-suggestions')) return 'Sugerencias y moderación';
  if (url === '/api/search' || url.startsWith('/api/osm')) return 'Descubrimiento geográfico';
  if (url.startsWith('/api/feed')) return 'Comunidad';
  return null;
}

function buildArchitecture() {
  return [
    { title: 'Cliente', tone: 'purple', items: [['React Native', 'iOS + Android'], ['Next.js web', 'PWA + SEO'], ['MapLibre GL JS', 'Mapas interactivos']] },
    { title: 'Backend / API', tone: 'green', items: [['Node.js + Fastify', 'API REST + GraphQL'], ['Socket.io', 'Feed y notifs en tiempo real'], ['Redis', 'Cache + sesiones']] },
    { title: 'Capa de datos', tone: 'blue', items: [['PostgreSQL + PostGIS', 'Datos geo + relacional'], ['MongoDB', 'Posts, reviews, feed'], ['Meilisearch', 'Busqueda por nombre/tipo']] },
    { title: 'Mapas y geolocalizacion', tone: 'amber', items: [['OpenStreetMap + Tiles', 'Mapas open source gratis'], ['Overpass API', 'Datos de negocios OSM'], ['Nominatim / Pelias', 'Geocodificacion']] },
    { title: 'Infraestructura y servicios', tone: 'red', items: [['Supabase Auth', 'Login social / OTP'], ['Cloudflare R2', 'Fotos y medios'], ['BullMQ + Vercel', 'Jobs + deploy CI/CD']] }
  ];
}

async function start() {
  await initPostgres();
  await initMongo();
  await initSearch();
  await seedDatabase();
  startWorkers(io);

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

process.on('SIGINT', async () => {
  await closeMongo();
  await closePostgres();
  await redis.quit();
  process.exit(0);
});

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});

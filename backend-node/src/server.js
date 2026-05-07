import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import mercurius from 'mercurius';
import { Server as SocketServer } from 'socket.io';
import { z } from 'zod';

import { config } from './config.js';
import { initPostgres, query, closePostgres } from './db/postgres.js';
import { initMongo, mongoDb, closeMongo } from './db/mongo.js';
import { seedDatabase } from './db/seed.js';
import { initSearch, searchSites } from './services/search.js';
import { notificationsQueue, searchQueue, startWorkers, redis } from './services/queues.js';
import { geocode, nearbyOsmBusinesses } from './services/osm.js';
import { createReview, createReviewForUser, getSite, listSites, refreshSiteMetrics } from './services/sites.js';
import { loginUser, optionalUser, registerUser, requireUser, toAuthUser } from './services/auth.js';

const app = Fastify({ logger: true });

await app.register(helmet);
await app.register(cors, { origin: [config.frontendOrigin, 'http://localhost:3000'], credentials: true });
await app.register(rateLimit, { max: 240, timeWindow: '1 minute' });
await app.register(swagger, {
  swagger: {
    info: { title: 'Rolling API', version: '0.1.0' }
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

app.get('/api/sites', async (request) => listSites(request.query));

app.get('/api/sites/:id', async (request, reply) => {
  const site = await getSite(request.params.id);
  if (!site) return reply.code(404).send({ error: 'Sitio no encontrado' });
  return site;
});

app.post('/api/sites/:id/reviews', async (request, reply) => {
  const parsed = reviewSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });

  const authUser = await optionalUser(request);
  const review = authUser
    ? await createReviewForUser({
        siteId: request.params.id,
        user: authUser,
        rating: parsed.data.rating,
        title: parsed.data.titulo,
        body: parsed.data.comentario,
        verified: parsed.data.verificada
      })
    : await createReview({
        siteId: request.params.id,
        username: parsed.data.username,
        rating: parsed.data.rating,
        title: parsed.data.titulo,
        body: parsed.data.comentario,
        verified: false
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
  const reason = String(request.body?.reason || '').slice(0, 80);
  const detail = String(request.body?.detail || '').slice(0, 1000);
  if (!reason) return reply.code(400).send({ error: 'Debes indicar una razon' });

  const result = await query(
    'INSERT INTO reports(site_id, reason, detail) VALUES($1, $2, $3) RETURNING *',
    [request.params.id, reason, detail]
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

app.post('/api/site-suggestions', async (request, reply) => {
  const parsed = suggestionSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues[0].message });
  const item = parsed.data;
  const result = await query(
    `
      INSERT INTO site_suggestions(name, category, address, locality, city, description, contact, suggested_by, lat, lng)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
    [
      item.nombre,
      item.categoria || 'Sitio local',
      item.direccion || null,
      item.localidad || null,
      item.ciudad || 'Bogota',
      item.descripcion,
      item.contacto || null,
      item.suggested_by || null,
      item.latitud || null,
      item.longitud || null
    ]
  );
  await notificationsQueue.add('suggestion:created', result.rows[0]);
  return reply.code(201).send({ suggestion: result.rows[0] });
});

app.get('/api/search', async (request) => searchSites(request.query.q || '', request.query));
app.get('/api/osm/geocode', async (request) => geocode(request.query.q || ''));
app.get('/api/osm/nearby', async (request) => nearbyOsmBusinesses({
  lat: Number(request.query.lat),
  lng: Number(request.query.lng),
  radius: Number(request.query.radius || 700)
}));

app.post('/api/osm/import-nearby', async (request, reply) => {
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
        INSERT INTO site_suggestions(name, category, address, locality, city, description, contact, suggested_by, lat, lng, status)
        VALUES($1,$2,$3,$4,$5,$6,$7,'overpass-osm',$8,$9,'pending')
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
  const post = {
    siteId: request.body?.siteId || null,
    type: request.body?.type || 'community',
    title: String(request.body?.title || '').slice(0, 140),
    body: String(request.body?.body || '').slice(0, 1600),
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

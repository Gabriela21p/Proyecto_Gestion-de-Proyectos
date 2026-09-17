import { query } from './postgres.js';
import { slugify, refreshSiteMetrics, reindexAllSites } from '../services/sites.js';
import { nearbyOsmBusinesses } from '../services/osm.js';
import bcrypt from 'bcryptjs';

const activities = [
  ['Cafe', 'coffee'],
  ['Restaurante', 'utensils'],
  ['Cultura', 'music'],
  ['Trabajo remoto', 'laptop'],
  ['Sostenible', 'leaf'],
  ['Eventos', 'calendar'],
  ['Familia', 'users'],
  ['Noche', 'moon']
];

const neighborhoods = {
  chapinero: ['Chapinero Central', 'Chapinero', 'Bogota'],
  laureles: ['Laureles', 'Laureles', 'Medellin'],
  getsemani: ['Getsemani', 'Getsemani', 'Cartagena'],
  usaquen: ['Usaquen', 'Usaquen', 'Bogota'],
  teusaquillo: ['La Soledad', 'Teusaquillo', 'Bogota'],
  engativa: ['Jardin Botanico', 'Engativa', 'Bogota'],
  candelaria: ['Centro Historico', 'La Candelaria', 'Bogota']
};

// Catálogo de arranque para demostrar la experiencia con lugares reales que
// pueden abrirse en Google Maps. No replica reseñas ni calificaciones de Google:
// esas señales deben construirse dentro de Rolling.
const googlePlacesDemo = [
  {
    name: 'Wilborada 1047',
    category: 'Libreria y cafe',
    address: 'Calle 71 #10-47 Int. 4',
    lat: 4.65347,
    lng: -74.05967,
    description: 'Casa libreria de Quinta Camacho con cafe, salas de lectura y una agenda cultural abierta.',
    neighborhood: 'chapinero',
    activities: ['Cafe', 'Cultura', 'Eventos']
  },
  {
    name: 'Cafe Cultor Quinta Camacho',
    category: 'Cafe de especialidad',
    address: 'Calle 70A #9-44',
    lat: 4.65303,
    lng: -74.05786,
    description: 'Cafe colombiano de especialidad en una casa de barrio pensada para conversar y conocer el origen del grano.',
    neighborhood: 'chapinero',
    activities: ['Cafe', 'Trabajo remoto', 'Sostenible']
  },
  {
    name: 'Mercado de las Pulgas de Usaquen',
    category: 'Mercado local',
    address: 'Carrera 6A entre calles 119 y 120A',
    lat: 4.69561,
    lng: -74.03072,
    description: 'Mercado tradicional de artesanias, antiguedades, sabores y emprendimientos locales.',
    neighborhood: 'usaquen',
    activities: ['Familia', 'Sostenible', 'Eventos']
  },
  {
    name: 'Biblioteca Publica Virgilio Barco',
    category: 'Biblioteca',
    address: 'Avenida Carrera 60 #57-60',
    lat: 4.65851,
    lng: -74.09317,
    description: 'Biblioteca publica rodeada de jardines y recorridos de agua, ideal para leer, estudiar y caminar.',
    neighborhood: 'teusaquillo',
    activities: ['Cultura', 'Trabajo remoto', 'Familia']
  },
  {
    name: 'Jardin Botanico de Bogota',
    category: 'Jardin botanico',
    address: 'Avenida Calle 63 #68-95',
    lat: 4.66869,
    lng: -74.10047,
    description: 'Colecciones vivas de la biodiversidad colombiana, senderos y experiencias ambientales para todas las edades.',
    neighborhood: 'engativa',
    activities: ['Sostenible', 'Familia', 'Eventos']
  },
  {
    name: 'Museo del Oro',
    category: 'Museo',
    address: 'Carrera 6 #15-88',
    lat: 4.60187,
    lng: -74.07202,
    description: 'Museo dedicado al patrimonio arqueologico y a las historias de las sociedades prehispanicas de Colombia.',
    neighborhood: 'candelaria',
    activities: ['Cultura', 'Familia']
  },
  {
    name: 'Centro Cultural Gabriel Garcia Marquez',
    category: 'Centro cultural',
    address: 'Calle 11 #5-60',
    lat: 4.59675,
    lng: -74.07315,
    description: 'Arquitectura, libreria, exposiciones y encuentros culturales en el corazon del centro historico.',
    neighborhood: 'candelaria',
    activities: ['Cultura', 'Cafe', 'Eventos']
  }
];

const sites = [
  {
    name: 'Cafe Circular',
    category: 'Cafe',
    address: 'Calle 59 #7-42',
    lat: 4.6486,
    lng: -74.0618,
    description: 'Cafe de especialidad con buen ambiente para trabajar, catas abiertas y comunidad creativa.',
    price: '$$',
    neighborhood: 'chapinero',
    activities: ['Cafe', 'Trabajo remoto', 'Eventos']
  },
  {
    name: 'La Huerta Vecina',
    category: 'Restaurante',
    address: 'Circular 73B #39-18',
    lat: 6.2444,
    lng: -75.5887,
    description: 'Restaurante local con mercado sostenible, talleres comunitarios y cocina de temporada.',
    price: '$$',
    neighborhood: 'laureles',
    activities: ['Restaurante', 'Sostenible', 'Eventos']
  },
  {
    name: 'Foro del Barrio',
    category: 'Cultura',
    address: 'Calle de la Media Luna',
    lat: 10.4236,
    lng: -75.5467,
    description: 'Espacio cultural con musica en vivo, exposiciones, conversaciones y agenda nocturna.',
    price: '$$',
    neighborhood: 'getsemani',
    activities: ['Cultura', 'Eventos', 'Noche']
  },
  {
    name: 'Patio Usaquen',
    category: 'Gastronomia',
    address: 'Carrera 6A #118-35',
    lat: 4.6951,
    lng: -74.0308,
    description: 'Patio gastronomico con comercios independientes, feria local y planes para ir en grupo.',
    price: '$$$',
    neighborhood: 'usaquen',
    activities: ['Restaurante', 'Eventos', 'Familia']
  },
  {
    name: 'Casa Taller La Soledad',
    category: 'Taller',
    address: 'Calle 39 #20-18',
    lat: 4.6307,
    lng: -74.0744,
    description: 'Casa cultural de barrio con talleres de ceramica, clubes de lectura y muestras de artistas locales.',
    price: '$',
    neighborhood: 'teusaquillo',
    activities: ['Cultura', 'Sostenible', 'Eventos']
  }
];

const reviews = [
  ['Cafe Circular', 5, 'Cafe impecable', 'Excelente cafe y muy buen servicio. Se siente una comunidad real.', true, 'ana_local'],
  ['Cafe Circular', 5, 'Perfecto para trabajar', 'Buena energia, internet estable y mesas comodas.', true, 'david_c'],
  ['Cafe Circular', 4, 'Buen evento', 'La cata estuvo bien organizada y el equipo responde con cuidado.', false, 'maria_t'],
  ['La Huerta Vecina', 5, 'Fresco y local', 'La comida se siente fresca, cercana y con proveedores del barrio.', true, 'lina'],
  ['La Huerta Vecina', 4, 'Volveria', 'Muy buenos talleres, buena atencion y precios razonables.', false, 'jota'],
  ['Foro del Barrio', 5, 'Agenda potente', 'La programacion cultural es de lo mejor de la zona.', true, 'cami'],
  ['Foro del Barrio', 4, 'Buen sonido', 'Buen sonido y curaduria. Ideal para descubrir artistas.', false, 'nico'],
  ['Patio Usaquen', 4, 'Variado', 'Variado y bonito para ir en grupo o con familia.', false, 'vale'],
  ['Casa Taller La Soledad', 5, 'Muy comunitario', 'Los talleres estan bien guiados y la casa tiene mucho cuidado.', true, 'sofi'],
  ['Casa Taller La Soledad', 5, 'Plan distinto', 'Un plan tranquilo y cultural para salir de lo obvio.', false, 'pipe']
];

const events = [
  ['Cafe Circular', 'Cata abierta de filtrados', 'Degustacion guiada por productores invitados.', 2, '6:30 p.m.', '$35.000'],
  ['La Huerta Vecina', 'Taller de cocina local', 'Clase practica con ingredientes de mercado campesino.', 5, '10:00 a.m.', '$45.000'],
  ['Foro del Barrio', 'Noche de musica local', 'Tres proyectos emergentes en vivo.', 3, '8:00 p.m.', '$25.000'],
  ['Patio Usaquen', 'Feria de marcas locales', 'Emprendimientos, comida y musica al aire libre.', 7, '11:00 a.m.', 'Entrada libre'],
  ['Casa Taller La Soledad', 'Club de lectura barrial', 'Encuentro abierto para leer y conversar.', 4, '5:00 p.m.', 'Entrada libre']
];

const bogotaSeedPoints = [
  { name: 'Chapinero', lat: 4.6486, lng: -74.0618, radius: 800 },
  { name: 'Usaquen', lat: 4.6951, lng: -74.0308, radius: 800 },
  { name: 'Teusaquillo', lat: 4.6307, lng: -74.0744, radius: 800 }
];

const adminUsers = [
  ['demo_rolling', 'demo@rolling.local', process.env.DEMO_ADMIN_PASSWORD || 'Demo12345*', 20, 1.6],
  ['dev1', 'dev1@careculosltda.com', process.env.DEV1_ADMIN_PASSWORD || 'careculos', 10, 1.6],
  ['sebas_admin', 'sebascarepicha@careculosltda.com', process.env.SEBAS_ADMIN_PASSWORD || 'RollingSebas2026*', 10, 1.6],
  ['santi_admin', 'santipanochapelada@careculosltda.com', process.env.SANTI_ADMIN_PASSWORD || 'RollingSanti2026*', 10, 1.6]
];

export async function seedDatabase() {
  await seedAdminUsers();

  const activityIds = new Map();
  for (const [name, icon] of activities) {
    const result = await query(
      `
        INSERT INTO activities(name, icon)
        VALUES($1, $2)
        ON CONFLICT(name) DO UPDATE SET icon = EXCLUDED.icon
        RETURNING id
      `,
      [name, icon]
    );
    activityIds.set(name, result.rows[0].id);
  }

  const neighborhoodIds = new Map();
  for (const [key, [name, locality, city]] of Object.entries(neighborhoods)) {
    const result = await query(
      `
        INSERT INTO neighborhoods(name, locality, city)
        VALUES($1, $2, $3)
        ON CONFLICT(name, locality, city) DO UPDATE SET city = EXCLUDED.city
        RETURNING id
      `,
      [name, locality, city]
    );
    neighborhoodIds.set(key, result.rows[0].id);
  }

  await syncGooglePlacesDemo({ neighborhoodIds, activityIds });

  if (process.env.SEED_DEMO_DATA !== '1') {
    await reindexAllSites();
    await seedRealOsmSuggestions();
    return;
  }

  const siteIds = new Map();
  for (const site of sites) {
    const result = await query(
      `
        INSERT INTO sites(neighborhood_id, name, slug, category, address, description, price_range, website, source, location)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, 'seed', ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography)
        ON CONFLICT(slug) DO UPDATE SET
          category = EXCLUDED.category,
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          price_range = EXCLUDED.price_range,
          location = EXCLUDED.location,
          updated_at = now()
        RETURNING id
      `,
      [
        neighborhoodIds.get(site.neighborhood),
        site.name,
        slugify(site.name),
        site.category,
        site.address,
        site.description,
        site.price,
        `https://rolling.local/${slugify(site.name)}`,
        site.lng,
        site.lat
      ]
    );
    const siteId = result.rows[0].id;
    siteIds.set(site.name, siteId);
    await query('DELETE FROM site_activities WHERE site_id = $1', [siteId]);
    for (const activity of site.activities) {
      await query(
        'INSERT INTO site_activities(site_id, activity_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
        [siteId, activityIds.get(activity)]
      );
    }
  }

  for (const [siteName, rating, title, body, verified, username] of reviews) {
    const user = await query(
      `
        INSERT INTO users(username, email, reputation)
        VALUES($1, $2, 5)
        ON CONFLICT(username) DO UPDATE SET reputation = users.reputation
        RETURNING id
      `,
      [username, `${username}@rolling.local`]
    );
    await query(
      `
        INSERT INTO reviews(site_id, user_id, rating, title, body, verified)
        SELECT $1, $2, $3, $4, $5, $6
        WHERE NOT EXISTS (
          SELECT 1 FROM reviews WHERE site_id = $1 AND title = $4
        )
      `,
      [siteIds.get(siteName), user.rows[0].id, rating, title, body, verified]
    );
  }

  const today = new Date();
  for (const [siteName, title, description, offset, time, cost] of events) {
    const start = new Date(today);
    start.setDate(today.getDate() + offset);
    const iso = start.toISOString().slice(0, 10);
    await query(
      `
        INSERT INTO events(site_id, title, description, starts_on, ends_on, time_label, cost_label)
        SELECT $1, $2, $3, $4, $4, $5, $6
        WHERE NOT EXISTS (
          SELECT 1 FROM events WHERE site_id = $1 AND title = $2
        )
      `,
      [siteIds.get(siteName), title, description, iso, time, cost]
    );
  }

  for (const siteId of siteIds.values()) {
    await refreshSiteMetrics(siteId);
  }
  await reindexAllSites();
  await seedRealOsmSuggestions();
}

async function syncGooglePlacesDemo({ neighborhoodIds, activityIds }) {
  const source = 'google_places_demo';
  const enabled = process.env.SEED_GOOGLE_PLACES_DEMO === '1';

  if (!enabled) {
    await query('DELETE FROM sites WHERE source = $1', [source]);
    return;
  }

  for (const site of googlePlacesDemo) {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name}, ${site.address}, Bogota`)}`;
    const result = await query(
      `
        INSERT INTO sites(neighborhood_id, name, slug, category, address, description, website, source, location)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, ST_SetSRID(ST_MakePoint($9, $10), 4326)::geography)
        ON CONFLICT(slug) DO UPDATE SET
          neighborhood_id = EXCLUDED.neighborhood_id,
          category = EXCLUDED.category,
          address = EXCLUDED.address,
          description = EXCLUDED.description,
          website = EXCLUDED.website,
          source = EXCLUDED.source,
          location = EXCLUDED.location,
          status = 'approved',
          updated_at = now()
        RETURNING id
      `,
      [
        neighborhoodIds.get(site.neighborhood),
        site.name,
        `google-demo-${slugify(site.name)}`,
        site.category,
        site.address,
        site.description,
        mapsUrl,
        source,
        site.lng,
        site.lat
      ]
    );

    await query('DELETE FROM site_activities WHERE site_id = $1', [result.rows[0].id]);
    for (const activity of site.activities) {
      await query(
        'INSERT INTO site_activities(site_id, activity_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
        [result.rows[0].id, activityIds.get(activity)]
      );
    }
  }
}

async function seedAdminUsers() {
  for (const [username, email, password, reputation, reviewWeight] of adminUsers) {
    const passwordHash = await bcrypt.hash(password, 12);
    await query(
      `
        INSERT INTO users(username, email, password_hash, auth_provider, email_verified, identity_level, role, reputation, review_weight)
        VALUES($1, $2, $3, 'local', true, 'registered', 'admin', $4, $5)
        ON CONFLICT(email) DO UPDATE SET
          username = EXCLUDED.username,
          password_hash = EXCLUDED.password_hash,
          auth_provider = EXCLUDED.auth_provider,
          email_verified = EXCLUDED.email_verified,
          identity_level = EXCLUDED.identity_level,
          role = EXCLUDED.role,
          reputation = EXCLUDED.reputation,
          review_weight = EXCLUDED.review_weight,
          updated_at = now()
      `,
      [username, email, passwordHash, reputation, reviewWeight]
    );
  }
}

async function seedRealOsmSuggestions() {
  if (process.env.SEED_REAL_OSM !== '1') return;

  for (const point of bogotaSeedPoints) {
    try {
      const elements = await nearbyOsmBusinesses(point);
      for (const element of elements.slice(0, 30)) {
        const tags = element.tags || {};
        const name = tags.name || tags.brand;
        if (!name) continue;

        const category = tags.amenity || tags.shop || tags.tourism || 'osm';
        const address = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
        await query(
          `
            INSERT INTO site_suggestions(name, category, address, locality, city, description, contact, suggested_by, lat, lng, status)
            VALUES($1,$2,$3,$4,$5,$6,$7,'overpass-osm',$8,$9,'pending')
            ON CONFLICT DO NOTHING
          `,
          [
            name,
            category,
            address || null,
            tags['addr:suburb'] || point.name,
            tags['addr:city'] || 'Bogota',
            `Semilla real importada desde OpenStreetMap. osm_id=${element.id}`,
            tags.phone || tags.website || null,
            element.lat || element.center?.lat,
            element.lon || element.center?.lon
          ]
        );
      }
    } catch {
      // La semilla real es opcional: no bloquea el arranque local.
    }
  }
}

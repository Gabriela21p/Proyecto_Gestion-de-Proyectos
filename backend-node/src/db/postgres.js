import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 12
});

export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return result;
}

export async function initPostgres() {
  await query('CREATE EXTENSION IF NOT EXISTS postgis');
  await query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'local',
      email_verified BOOLEAN NOT NULL DEFAULT false,
      identity_level TEXT NOT NULL DEFAULT 'guest',
      role TEXT NOT NULL DEFAULT 'neighbor',
      reputation INTEGER NOT NULL DEFAULT 0,
      review_weight NUMERIC(4,2) NOT NULL DEFAULT 1,
      avatar_url TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await ensureColumn('users', 'password_hash', 'TEXT');
  await ensureColumn('users', 'auth_provider', "TEXT NOT NULL DEFAULT 'local'");
  await ensureColumn('users', 'email_verified', 'BOOLEAN NOT NULL DEFAULT false');
  await ensureColumn('users', 'identity_level', "TEXT NOT NULL DEFAULT 'guest'");
  await ensureColumn('users', 'review_weight', 'NUMERIC(4,2) NOT NULL DEFAULT 1');
  await ensureColumn('users', 'updated_at', 'TIMESTAMPTZ NOT NULL DEFAULT now()');

  await query(`
    CREATE TABLE IF NOT EXISTS neighborhoods (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      locality TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT 'Colombia',
      UNIQUE(name, locality, city)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS activities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      icon TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS sites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      neighborhood_id UUID REFERENCES neighborhoods(id),
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      category TEXT NOT NULL DEFAULT 'Sitio local',
      address TEXT,
      description TEXT,
      price_range TEXT,
      phone TEXT,
      website TEXT,
      image_url TEXT,
      source TEXT NOT NULL DEFAULT 'community',
      status TEXT NOT NULL DEFAULT 'approved',
      featured BOOLEAN NOT NULL DEFAULT false,
      rating_average NUMERIC(3,2) NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      verified_review_count INTEGER NOT NULL DEFAULT 0,
      active_event_count INTEGER NOT NULL DEFAULT 0,
      trust_score NUMERIC(6,2) NOT NULL DEFAULT 0,
      location GEOGRAPHY(Point, 4326) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS site_activities (
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
      PRIMARY KEY (site_id, activity_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      title TEXT,
      body TEXT NOT NULL,
      visited_at DATE,
      verified BOOLEAN NOT NULL DEFAULT false,
      weight NUMERIC(4,2) NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'published',
      helpful_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await ensureColumn('reviews', 'weight', 'NUMERIC(4,2) NOT NULL DEFAULT 1');

  await query(`
    CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      starts_on DATE NOT NULL,
      ends_on DATE NOT NULL,
      time_label TEXT,
      cost_label TEXT,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, site_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      detail TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS site_suggestions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      category TEXT,
      address TEXT,
      locality TEXT,
      city TEXT DEFAULT 'Bogota',
      description TEXT NOT NULL,
      contact TEXT,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      suggested_by TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      status TEXT NOT NULL DEFAULT 'pending',
      duplicate_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
      approved_site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
      reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
      reviewed_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await ensureColumn('site_suggestions', 'user_id', 'UUID REFERENCES users(id) ON DELETE SET NULL');
  await ensureColumn('site_suggestions', 'duplicate_site_id', 'UUID REFERENCES sites(id) ON DELETE SET NULL');
  await ensureColumn('site_suggestions', 'approved_site_id', 'UUID REFERENCES sites(id) ON DELETE SET NULL');
  await ensureColumn('site_suggestions', 'reviewed_by', 'UUID REFERENCES users(id) ON DELETE SET NULL');
  await ensureColumn('site_suggestions', 'reviewed_at', 'TIMESTAMPTZ');
  await ensureColumn('site_suggestions', 'rejection_reason', 'TEXT');

  await query('CREATE INDEX IF NOT EXISTS idx_sites_location ON sites USING GIST(location)');
  await query('CREATE INDEX IF NOT EXISTS idx_sites_status_score ON sites(status, trust_score DESC, rating_average DESC)');
  await query('CREATE INDEX IF NOT EXISTS idx_sites_category ON sites(category, status)');
  await query('CREATE INDEX IF NOT EXISTS idx_reviews_site_status ON reviews(site_id, status, created_at DESC)');
  await query('CREATE INDEX IF NOT EXISTS idx_events_dates ON events(status, starts_on, ends_on)');
  await query('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC)');
  await query('CREATE INDEX IF NOT EXISTS idx_site_suggestions_status ON site_suggestions(status, created_at DESC)');
}

async function ensureColumn(table, column, definition) {
  await query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${definition}`);
}

export async function closePostgres() {
  await pool.end();
}

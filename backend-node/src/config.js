import 'dotenv/config';

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || 'postgres://rolling:rolling@localhost:5432/rolling',
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017/rolling',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  meiliHost: process.env.MEILI_HOST || 'http://localhost:7700',
  meiliMasterKey: process.env.MEILI_MASTER_KEY || 'rolling_master_key',
  jwtSecret: process.env.JWT_SECRET || 'dev-change-this-secret-before-production',
  jwtIssuer: process.env.JWT_ISSUER || 'rolling-api',
  nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  overpassUrl: process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
  osmTileUrl: process.env.OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  r2Bucket: process.env.CLOUDFLARE_R2_BUCKET || 'rolling-media'
};

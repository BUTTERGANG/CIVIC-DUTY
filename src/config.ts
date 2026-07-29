// src/config.ts
// Loads .env and validates required settings once, at boot. Importing this
// module for its side effects guarantees every other module sees a populated
// process.env — and that a misconfigured deploy fails loudly on startup
// instead of at the first login or first query.
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/** Values that must be present, with the reason surfaced if they aren't. */
const REQUIRED: Record<string, string> = {
  DATABASE_URL: 'Postgres connection string (Neon, Replit PG, or local)',
  JWT_SECRET: 'signing secret for auth tokens — generate 64 random bytes',
};

const missing = Object.keys(REQUIRED).filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error('[Config] Missing required environment variables:\n');
  for (const key of missing) {
    console.error(`  ${key}  — ${REQUIRED[key]}`);
  }
  console.error('\nSet these in .env locally, or in Replit Secrets when deployed.');
  console.error('See .env.example for the full list.\n');
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  // Cron scrapers must run on exactly one always-on instance. Disable this on
  // Replit Autoscale (which sleeps and scales out) and run the scheduler as a
  // separate Reserved VM deployment instead.
  schedulerEnabled: process.env.ENABLE_SCHEDULER !== 'false',
  // Absolute path to the built frontend, served by the API in production.
  uiDist: path.resolve(__dirname, '../CIVIC-DUTY-UI/dist'),
};

import { Pool } from 'pg';
import { config } from '../config';

// No localhost fallback on purpose — config.ts hard-fails at boot when
// DATABASE_URL is unset, so a misconfigured deploy can't quietly point itself
// at a database that isn't there.
export const pool = new Pool({
  connectionString: config.databaseUrl,
});

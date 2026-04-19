import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Supabase's connection pooler uses intermediate certificates that Node.js
// doesn't natively trust. rejectUnauthorized must be false for pooler connections.
// This is safe because traffic is still encrypted via TLS — we just skip
// certificate chain verification (a documented Supabase requirement).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
  process.exit(-1);
});

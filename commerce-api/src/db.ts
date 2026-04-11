import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Manually construct the URL explicitly to aggressively bypass all pg-connection-string parsing bugs
const rawUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim().replace(/['"]/g, '') : '';
const parsed = new URL(rawUrl);

export const pool = new Pool({
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  host: parsed.hostname,
  port: parseInt(parsed.port, 10) || 5432,
  database: decodeURIComponent(parsed.pathname.replace('/', '')),
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
  process.exit(-1);
});

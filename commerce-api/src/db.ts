import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Sanitize the URL perfectly in case of copy-paste invisible quotes or whitespaces from Render dashboard
const cleanDbUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim().replace(/['"]/g, '') : '';

export const pool = new Pool({
  connectionString: cleanDbUrl,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
  process.exit(-1);
});

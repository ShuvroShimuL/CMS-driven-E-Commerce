import { Pool } from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';

// Render free instances lack outbound IPv6. 
// Supabase poolers return dual-stack DNS, so Node 17+ aggressively attempts IPv6 and crashes.
dns.setDefaultResultOrder('ipv4first');

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client', err);
  process.exit(-1);
});

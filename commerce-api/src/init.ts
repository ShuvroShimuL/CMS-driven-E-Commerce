import { pool } from './db';

// ─── Exported migration function — safe to call on every server start ─────────
// Uses CREATE TABLE IF NOT EXISTS throughout, so re-running is always idempotent.
export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Sprint 5: Inventory & Transactions ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_inventory (
        id SERIAL PRIMARY KEY,
        strapi_id INTEGER UNIQUE NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        available_qty INTEGER NOT NULL DEFAULT 0,
        reserved_qty INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_transactions (
        id SERIAL PRIMARY KEY,
        transaction_id VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        total_amount DECIMAL(10, 2) NOT NULL,
        cart_items JSONB NOT NULL,
        customer_info JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      )
    `);

    // ── Sprint 6: User accounts ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_users (
        id BIGSERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        phone TEXT,
        cart_session_id TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_otps (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        otp_code TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_refresh_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES commerce_users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_password_resets (
        id BIGSERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Sprint 8: Coupons ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_coupons (
        id BIGSERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed')),
        value DECIMAL(10, 2) NOT NULL CHECK (value > 0),
        min_order_amount DECIMAL(10, 2) DEFAULT 0,
        max_discount DECIMAL(10, 2),
        usage_limit INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        expires_at TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_commerce_coupons_code ON commerce_coupons (code)
    `);

    // ── Sprint 8: Dead-Letter Queue ───────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS commerce_dlq (
        id BIGSERIAL PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_attempted_at TIMESTAMPTZ DEFAULT NOW(),
        resolved BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query('COMMIT');
    console.log('✅ [Migrations] All tables up to date');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ [Migrations] Failed:', e);
    throw e;
  } finally {
    client.release();
  }
}

// ─── Standalone runner (npm run init-db) ─────────────────────────────────────
async function main() {
  await runMigrations();
  await pool.end();
  console.log('✅ Commerce Engine DB Tables Initialized Successfully!');
}

main().catch((e) => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});

import { pool } from './db';

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create table for duplicated product data (Inventory)
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

    // Create table for tracking active Cart/Order sessions and transactions
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

    await client.query('COMMIT');
    console.log('Commerce Engine DB Tables Created Successfully!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
    pool.end();
  }
}

initializeDatabase();

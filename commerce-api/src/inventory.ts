import { pool } from './db';
import { writeToDLQ } from './dlq';

export async function syncInventoryProduct(entry: any) {
  const active = Boolean(entry.publishedAt) && entry.status !== 'archived';
  await pool.query(`
    INSERT INTO commerce_inventory (strapi_id, slug, name, price, available_qty, is_active, strapi_updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (strapi_id) DO UPDATE SET
      slug = EXCLUDED.slug, name = EXCLUDED.name, price = EXCLUDED.price,
      available_qty = GREATEST(EXCLUDED.available_qty - commerce_inventory.reserved_qty - commerce_inventory.pending_sync_qty, 0),
      is_active = EXCLUDED.is_active, strapi_updated_at = EXCLUDED.strapi_updated_at,
      updated_at = NOW()
    WHERE commerce_inventory.strapi_updated_at IS NULL
      OR EXCLUDED.strapi_updated_at > commerce_inventory.strapi_updated_at
  `, [entry.id, entry.slug, entry.title, entry.price, entry.stock ?? 0, active, entry.updatedAt || entry.publishedAt || null]);
}

/** Serialize CMS stock changes across API workers; retain unsynced sales locally. */
export async function decrementStrapiStock(strapiId: number, qty: number) {
  const url = process.env.STRAPI_URL || 'https://cms-driven-e-commerce.onrender.com';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (process.env.STRAPI_API_TOKEN) headers.Authorization = `Bearer ${process.env.STRAPI_API_TOKEN}`;
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    // A separate advisory lock avoids holding the inventory row during network I/O.
    await client.query('SELECT pg_advisory_xact_lock(7216, $1)', [strapiId]);
    const current = await fetch(`${url}/api/products/${strapiId}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!current.ok) throw new Error(`Strapi product fetch failed (${current.status})`);
    const product = await current.json();
    const stock = Number(product?.data?.attributes?.stock);
    if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('Invalid CMS stock');
    const newStock = Math.max(0, stock - qty);
    const updated = await fetch(`${url}/api/products/${strapiId}`, {
      method: 'PUT', headers, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ data: { stock: newStock } }),
    });
    if (!updated.ok) throw new Error(`Strapi product update failed (${updated.status})`);
    const saved = await updated.json();
    const updatedAt = saved?.data?.attributes?.updatedAt;
    if (!updatedAt) throw new Error('CMS stock response is missing updatedAt');
    await client.query(`
      UPDATE commerce_inventory SET
        available_qty = CASE WHEN strapi_updated_at IS NULL OR strapi_updated_at <= $3::timestamptz
          THEN GREATEST($4 - reserved_qty - GREATEST(pending_sync_qty - $2, 0), 0)
          ELSE available_qty + LEAST(pending_sync_qty, $2) END,
        pending_sync_qty = GREATEST(pending_sync_qty - $2, 0),
        strapi_updated_at = GREATEST(strapi_updated_at, $3::timestamptz), updated_at = NOW()
      WHERE strapi_id = $1
    `, [strapiId, qty, updatedAt, newStock]);
    await client.query('COMMIT');
  } catch (error: any) {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
      client = undefined;
    }
    await writeToDLQ('product_sync', { strapiId, qty, action: 'decrement' }, error.message);
  } finally {
    client?.release();
  }
}

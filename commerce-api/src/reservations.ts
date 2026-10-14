import { pool } from './db';

/** All cancellation paths lock the transaction before changing its inventory. */
export async function releasePendingTransactions(scope: 'expired' | 'all' = 'expired') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, transaction_id, cart_items, customer_info FROM commerce_transactions
      WHERE status = 'PENDING' AND ($1 = 'all' OR expires_at < NOW())
      ORDER BY id FOR UPDATE SKIP LOCKED
    `, [scope]);
    for (const tx of rows) {
      for (const item of [...tx.cart_items].sort((a, b) => a.id - b.id)) {
        await client.query(`
          UPDATE commerce_inventory SET available_qty = available_qty + $2,
            reserved_qty = GREATEST(reserved_qty - $2, 0) WHERE strapi_id = $1
        `, [item.id, item.quantity]);
      }
      if (tx.customer_info?.coupon?.code) {
        await client.query(`UPDATE commerce_coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = $1`,
          [tx.customer_info.coupon.code]);
      }
      await client.query(`UPDATE commerce_transactions SET status = 'CANCELLED_TIMEOUT' WHERE id = $1`, [tx.id]);
    }
    await client.query('COMMIT');
    return rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

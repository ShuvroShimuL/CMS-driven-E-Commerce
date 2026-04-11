import cron from 'node-cron';
import { pool } from './db';

// Run every 1 minute
cron.schedule('* * * * *', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Select all expired, PENDING transactions that haven't been resolved
    const { rows } = await client.query(`
      SELECT id, transaction_id, cart_items 
      FROM commerce_transactions 
      WHERE status = 'PENDING' AND expires_at < NOW()
    `);

    for (const transaction of rows) {
      const items = transaction.cart_items;
      
      // Iterate through locked items and release them back to pool
      for (const item of items) {
        await client.query(`
          UPDATE commerce_inventory 
          SET available_qty = available_qty + $2, 
              reserved_qty = reserved_qty - $2 
          WHERE strapi_id = $1
        `, [item.id, item.quantity]);
      }

      // Mark transaction definitively as timed out
      await client.query(`
        UPDATE commerce_transactions 
        SET status = 'CANCELLED_TIMEOUT'
        WHERE id = $1
      `, [transaction.id]);
      
      console.log(`Released inventory lock for expired transaction ${transaction.transaction_id}`);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Cron Expiry Job Error:', e);
  } finally {
    client.release();
  }
});

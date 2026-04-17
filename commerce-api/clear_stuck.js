const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.vhjpcyinxotihfusjwli:yWbySBCJusunn47Z@aws-1-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function clearStuck() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, cart_items FROM commerce_transactions WHERE status = 'PENDING'
    `);
    
    let releasedCount = 0;
    for (const tx of rows) {
      console.log('Releasing tx:', tx.id);
      for (const item of tx.cart_items) {
        await client.query(`
          UPDATE commerce_inventory
          SET available_qty = available_qty + $2, reserved_qty = GREATEST(reserved_qty - $2, 0)
          WHERE strapi_id = $1
        `, [item.id, item.quantity]);
      }
      await client.query(`UPDATE commerce_transactions SET status = 'CANCELLED_TIMEOUT' WHERE id = $1`, [tx.id]);
      releasedCount++;
    }
    await client.query('COMMIT');
    console.log(`Successfully released ${releasedCount} stuck transactions.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

clearStuck();

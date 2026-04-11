import { Router } from 'express';
import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ----------------------------------------------------
// Strapi Product Sync Webhook (Sprint 5 Product Mirror)
// ----------------------------------------------------
router.post('/sync/product', async (req, res) => {
  const { event, model, entry } = req.body;

  if (model !== 'product' || !entry) {
    return res.status(400).json({ message: 'Irrelevant model' });
  }

  const { id: strapi_id, slug, title, price, stock, publishedAt } = entry;

  // We only sync published products natively
  if (event === 'entry.unpublish' || !publishedAt) {
    await pool.query('DELETE FROM commerce_inventory WHERE slug = $1', [slug]);
    return res.json({ success: true, action: 'deleted' });
  }

  try {
    const upsertQuery = `
      INSERT INTO commerce_inventory (strapi_id, slug, name, price, available_qty)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (slug) 
      DO UPDATE SET 
        strapi_id = EXCLUDED.strapi_id,
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        available_qty = EXCLUDED.available_qty,
        updated_at = CURRENT_TIMESTAMP;
    `;
    
    await pool.query(upsertQuery, [strapi_id, slug, title, price, stock || 0]);
    res.json({ success: true, action: 'upserted' });
  } catch (error) {
    console.error('Webhook sync failed:', error);
    res.status(500).json({ message: 'Database sync failure' });
  }
});

// ----------------------------------------------------
// Initiate SSLCommerz Checkout & Pessimistic Lock
// ----------------------------------------------------
router.post('/payments/sslcommerz/initiate', async (req, res) => {
  const { items, customer, subtotal } = req.body;
  const transaction_id = uuidv4();

  const client = await pool.connect();
  let lockAcquired = false;

  try {
    await client.query('BEGIN');

    for (const item of items) {
      // PESSIMISTIC LOCK: SKIP LOCKED
      // Guarantees high-concurrency safety.
      const lockRes = await client.query(`
        SELECT available_qty FROM commerce_inventory 
        WHERE strapi_id = $1 AND available_qty >= $2 
        FOR UPDATE SKIP LOCKED
      `, [item.id, item.quantity]);

      if (lockRes.rowCount === 0) {
        throw new Error(\`Product \${item.id} is out of stock or currently locked by another checkout.\`);
      }

      // Decrement Available, Increment Reserved
      await client.query(`
        UPDATE commerce_inventory 
        SET available_qty = available_qty - $2, 
            reserved_qty = reserved_qty + $2 
        WHERE strapi_id = $1
      `, [item.id, item.quantity]);
    }

    lockAcquired = true;

    // Record Transaction Session
    // Set 15 minutes expiry to clear orphan reservations
    const expiresAt = new Date(Date.now() + 15 * 60000); 
    
    await client.query(`
      INSERT INTO commerce_transactions (transaction_id, status, total_amount, cart_items, customer_info, expires_at)
      VALUES ($1, 'PENDING', $2, $3, $4, $5)
    `, [transaction_id, subtotal, JSON.stringify(items), JSON.stringify(customer), expiresAt]);

    await client.query('COMMIT');
    
    // Simulate SSLCommerz Response for Sprint 5 logic
    const gatewayUrl = \`https://sandbox.sslcommerz.com/mock_gateway/\${transaction_id}\`;
    
    res.json({ success: true, transaction_id, gatewayUrl });

  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
});

// ----------------------------------------------------
// SSLCommerz IPN Handler (Webhook Callback)
// ----------------------------------------------------
router.post('/payments/ipn/sslcommerz', async (req, res) => {
  const { tran_id, status, val_id, amount } = req.body;

  if (!tran_id) {
    return res.status(400).send('Invalid IPN request');
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Fetch Transaction & Enforce Idempotency
    const { rows } = await client.query(
      'SELECT status, cart_items FROM commerce_transactions WHERE transaction_id = $1 FOR UPDATE',
      [tran_id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send('Transaction not found');
    }

    const tx = rows[0];

    // Idempotency: If already resolved, ignore it
    if (tx.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(200).send('Already processed');
    }

    if (status === 'VALID' || status === 'VALIDATED') {
      // 2. Commit the Reserved Stock permanently
      const items = tx.cart_items;
      for (const item of items) {
        await client.query(`
          UPDATE commerce_inventory 
          SET reserved_qty = reserved_qty - $2 
          WHERE strapi_id = $1
        `, [item.id, item.quantity]);
      }

      // Mark transaction as SUCCESS
      await client.query(`
        UPDATE commerce_transactions 
        SET status = 'PAID'
        WHERE transaction_id = $1
      `, [tran_id]);

      // TODO: Here we would trigger the Strapi POST /api/orders to officially record for admin viewing
      
    } else {
      // 3. Failed/Cancelled: Release Stock early
      const items = tx.cart_items;
      for (const item of items) {
        await client.query(`
          UPDATE commerce_inventory 
          SET available_qty = available_qty + $2,
              reserved_qty = reserved_qty - $2 
          WHERE strapi_id = $1
        `, [item.id, item.quantity]);
      }

      // Mark transaction as FAILED
      await client.query(`
        UPDATE commerce_transactions 
        SET status = 'FAILED'
        WHERE transaction_id = $1
      `, [tran_id]);
    }

    await client.query('COMMIT');
    res.status(200).send('IPN Handled');

  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('IPN processing error:', err.message);
    res.status(500).send('Internal Error');
  } finally {
    client.release();
  }
});

export default router;

import { Router } from 'express';
import { pool } from './db';
import { v4 as uuidv4 } from 'uuid';
import { adminApiKeyMiddleware, checkoutLimiter } from './middleware';

const router = Router();

// ----------------------------------------------------
// Health / Debug: Inspect inventory table
// ----------------------------------------------------
router.get('/admin/inventory', adminApiKeyMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM commerce_inventory ORDER BY strapi_id ASC');
    res.json({ count: rows.length, inventory: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Debug: Manually seed / reset a product in inventory
// POST body: { strapi_id, slug, name, price, stock }
// ----------------------------------------------------
router.post('/admin/seed-inventory', adminApiKeyMiddleware, async (req, res) => {
  const { strapi_id, slug, name, price, stock } = req.body;
  if (!strapi_id || !slug) {
    return res.status(400).json({ error: 'strapi_id and slug are required' });
  }
  try {
    await pool.query(`
      INSERT INTO commerce_inventory (strapi_id, slug, name, price, available_qty, reserved_qty)
      VALUES ($1, $2, $3, $4, $5, 0)
      ON CONFLICT (slug) DO UPDATE SET
        strapi_id = EXCLUDED.strapi_id,
        name = EXCLUDED.name,
        price = EXCLUDED.price,
        available_qty = EXCLUDED.available_qty,
        reserved_qty = 0,
        updated_at = CURRENT_TIMESTAMP
    `, [strapi_id, slug, name || slug, price || 0, stock || 100]);
    res.json({ success: true, message: `Inventory seeded for strapi_id=${strapi_id}, slug=${slug}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Debug: Release all stuck PENDING reservations immediately
// ----------------------------------------------------
router.post('/admin/release-stuck', adminApiKeyMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, cart_items FROM commerce_transactions WHERE status = 'PENDING'
    `);
    for (const tx of rows) {
      for (const item of tx.cart_items) {
        await client.query(`
          UPDATE commerce_inventory
          SET available_qty = available_qty + $2, reserved_qty = GREATEST(reserved_qty - $2, 0)
          WHERE strapi_id = $1
        `, [item.id, item.quantity]);
      }
      await client.query(`UPDATE commerce_transactions SET status = 'CANCELLED_TIMEOUT' WHERE id = $1`, [tx.id]);
    }
    await client.query('COMMIT');
    res.json({ success: true, released: rows.length });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ----------------------------------------------------
// Admin: Wipe inventory table (useful before a full re-sync)
// ----------------------------------------------------
router.post('/admin/clear-inventory', adminApiKeyMiddleware, async (req, res) => {
  try {
    await pool.query('TRUNCATE TABLE commerce_inventory RESTART IDENTITY');
    res.json({ success: true, message: 'Inventory table cleared' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Admin: Pull ALL published products from Strapi and  
// upsert them into commerce_inventory with correct IDs.
// Call this once after deploy to seed correctly.
// ----------------------------------------------------
router.post('/admin/sync-from-strapi', adminApiKeyMiddleware, async (req, res) => {
  const STRAPI_URL = process.env.STRAPI_URL || 'https://cms-driven-e-commerce.onrender.com';
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (STRAPI_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;

    // Fetch all published products from Strapi
    const strapiRes = await fetch(
      `${STRAPI_URL}/api/products?pagination[pageSize]=100&publicationState=live`,
      { headers }
    );

    if (!strapiRes.ok) {
      const text = await strapiRes.text();
      return res.status(502).json({ error: 'Strapi fetch failed', detail: text });
    }

    const { data } = await strapiRes.json();
    if (!data || data.length === 0) {
      return res.json({ success: true, synced: 0, message: 'No published products found in Strapi' });
    }

    let synced = 0;
    const results: any[] = [];

    for (const product of data) {
      const strapi_id = product.id;
      const { slug, title, price, stock } = product.attributes;

      await pool.query(`
        INSERT INTO commerce_inventory (strapi_id, slug, name, price, available_qty, reserved_qty)
        VALUES ($1, $2, $3, $4, $5, 0)
        ON CONFLICT (strapi_id) DO UPDATE SET
          slug = EXCLUDED.slug,
          name = EXCLUDED.name,
          price = EXCLUDED.price,
          available_qty = EXCLUDED.available_qty,
          updated_at = CURRENT_TIMESTAMP
      `, [strapi_id, slug, title, price || 0, stock || 0]);

      results.push({ strapi_id, slug, name: title, price, stock });
      synced++;
    }

    res.json({ success: true, synced, products: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


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
      ON CONFLICT (strapi_id) 
      DO UPDATE SET 
        slug = EXCLUDED.slug,
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
router.post('/payments/sslcommerz/initiate', checkoutLimiter, async (req, res) => {
  const { items, customer, subtotal, shippingCost, totalAmount, couponCode } = req.body;
  const transaction_id = uuidv4();

  let client;
  let lockAcquired = false;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    for (const item of items) {
      // PESSIMISTIC LOCK: SKIP LOCKED
      const lockRes = await client.query(`
        SELECT available_qty FROM commerce_inventory 
        WHERE strapi_id = $1 AND available_qty >= $2 
        FOR UPDATE SKIP LOCKED
      `, [item.id, item.quantity]);

      if (lockRes.rowCount === 0) {
        throw new Error(`Product ${item.id} is out of stock or currently locked by another checkout.`);
      }

      await client.query(`
        UPDATE commerce_inventory 
        SET available_qty = available_qty - $2, 
            reserved_qty = reserved_qty + $2 
        WHERE strapi_id = $1
      `, [item.id, item.quantity]);
    }

    lockAcquired = true;

    // ── Coupon validation (inside transaction so used_count is atomic) ────────
    let discountAmount = 0;
    let appliedCoupon: any = null;

    if (couponCode && couponCode.trim()) {
      const code = couponCode.trim().toUpperCase();
      const { rows: couponRows } = await client.query(
        `SELECT * FROM commerce_coupons WHERE code = $1 FOR UPDATE`,
        [code]
      );

      if (couponRows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Coupon "${code}" not found` });
      }

      const coupon = couponRows[0];
      const baseTotal = totalAmount || subtotal;

      if (!coupon.is_active) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'This coupon is no longer active' });
      }
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'This coupon has expired' });
      }
      if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'This coupon has reached its usage limit' });
      }
      if (parseFloat(coupon.min_order_amount) > 0 && baseTotal < parseFloat(coupon.min_order_amount)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Minimum order for this coupon is Tk ${coupon.min_order_amount}`
        });
      }

      // Calculate discount
      if (coupon.type === 'percentage') {
        const raw = (baseTotal * parseFloat(coupon.value)) / 100;
        discountAmount = coupon.max_discount
          ? Math.min(raw, parseFloat(coupon.max_discount))
          : raw;
      } else {
        discountAmount = Math.min(parseFloat(coupon.value), baseTotal);
      }
      discountAmount = Math.round(discountAmount * 100) / 100;

      // Atomically increment used_count
      await client.query(
        `UPDATE commerce_coupons SET used_count = used_count + 1 WHERE id = $1`,
        [coupon.id]
      );
      appliedCoupon = { code: coupon.code, type: coupon.type, value: parseFloat(coupon.value) };
    }

    // Final total after discount
    const baseTotal = totalAmount || subtotal;
    const finalTotal = Math.max(0, baseTotal - discountAmount);

    // Set 15 minutes expiry to clear orphan reservations
    const expiresAt = new Date(Date.now() + 15 * 60000);

    const customerWithMeta = { ...customer, shippingCost, coupon: appliedCoupon, discountAmount };

    await client.query(`
      INSERT INTO commerce_transactions (transaction_id, status, total_amount, cart_items, customer_info, expires_at)
      VALUES ($1, 'PENDING', $2, $3, $4, $5)
    `, [transaction_id, finalTotal, JSON.stringify(items), JSON.stringify(customerWithMeta), expiresAt]);

    await client.query('COMMIT');

    // Simulate SSLCommerz Response (stub until live credentials)
    const gatewayUrl = `https://sandbox.sslcommerz.com/mock_gateway/${transaction_id}`;

    res.json({
      success: true, transaction_id, gatewayUrl,
      discountAmount, finalTotal,
      coupon: appliedCoupon
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    res.status(400).json({ success: false, message: error.message || 'Checkout failed' });
  } finally {
    if (client) client.release();
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

      // Fetch the full transaction details to create the Strapi order
      const { rows: txRows } = await client.query(
        'SELECT * FROM commerce_transactions WHERE transaction_id = $1',
        [tran_id]
      );
      const fullTx = txRows[0];

      // Create order in Strapi for admin visibility
      await createStrapiOrder(fullTx, items);

      // Decrement Strapi stock for each sold item
      for (const item of items) {
        await decrementStrapiStock(item.id, item.quantity);
      }
      
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

// =====================================================
// HELPER: Create a Strapi Order for admin visibility
// =====================================================
async function createStrapiOrder(tx: any, items: any[]) {
  const STRAPI_URL = process.env.STRAPI_URL || 'https://cms-driven-e-commerce.onrender.com';
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

  const customer = tx.customer_info || {};
  const payload = {
    data: {
      fullName: customer.fullName || customer.name || 'Customer',
      email: customer.email || '',
      phone: customer.phone || '',
      fullAddress: customer.fullAddress || customer.address || '',
      division: customer.division || '',
      district: customer.district || '',
      thana: customer.thana || '',
      cartItems: items,
      totalAmount: parseFloat(tx.total_amount),
      status: 'confirmed',
    }
  };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (STRAPI_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;

    const res = await fetch(`${STRAPI_URL}/api/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[Order] Strapi order creation failed:', text);
    } else {
      console.log('[Order] Strapi order created successfully');
    }
  } catch (err: any) {
    console.error('[Order] Could not reach Strapi:', err.message);
  }
}

// =====================================================
// HELPER: Decrement Strapi product stock
// =====================================================
async function decrementStrapiStock(strapiId: number, qty: number) {
  const STRAPI_URL = process.env.STRAPI_URL || 'https://cms-driven-e-commerce.onrender.com';
  const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (STRAPI_TOKEN) headers['Authorization'] = `Bearer ${STRAPI_TOKEN}`;

    // Fetch current stock first
    const getRes = await fetch(`${STRAPI_URL}/api/products/${strapiId}`, { headers });
    if (!getRes.ok) return;
    const productData = await getRes.json();
    const currentStock = productData?.data?.attributes?.stock ?? 0;
    const newStock = Math.max(0, currentStock - qty);

    // Update stock
    await fetch(`${STRAPI_URL}/api/products/${strapiId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ data: { stock: newStock } })
    });
    console.log(`[Stock] Product ${strapiId} stock: ${currentStock} -> ${newStock}`);
  } catch (err: any) {
    console.error('[Stock] Could not update Strapi stock:', err.message);
  }
}

// =====================================================
// COD Confirm endpoint — for use until SSLCommerz is live
// Simulates a successful payment confirmation
// =====================================================
router.post('/payments/confirm-cod', checkoutLimiter, async (req, res) => {
  const { transaction_id } = req.body;
  if (!transaction_id) return res.status(400).json({ error: 'transaction_id required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      'SELECT * FROM commerce_transactions WHERE transaction_id = $1 FOR UPDATE',
      [transaction_id]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const tx = rows[0];
    if (tx.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(200).json({ message: 'Already processed', status: tx.status });
    }

    const items = tx.cart_items;

    // Commit reserved stock (remove reservation, stock already decremented at lock time)
    for (const item of items) {
      await client.query(`
        UPDATE commerce_inventory 
        SET reserved_qty = GREATEST(reserved_qty - $2, 0)
        WHERE strapi_id = $1
      `, [item.id, item.quantity]);
    }

    await client.query(
      `UPDATE commerce_transactions SET status = 'PAID' WHERE transaction_id = $1`,
      [transaction_id]
    );

    await client.query('COMMIT');

    // Create Strapi order + decrement stock (outside DB transaction, best-effort)
    await createStrapiOrder(tx, items);
    for (const item of items) {
      await decrementStrapiStock(item.id, item.quantity);
    }

    res.json({ success: true, message: 'COD order confirmed', transaction_id });

  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export { router as commerceRoutes };


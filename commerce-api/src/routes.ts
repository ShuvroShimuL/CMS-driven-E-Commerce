import { Router } from 'express';
import { pool } from './db';
import { randomUUID } from 'crypto';
import { adminApiKeyMiddleware, checkoutLimiter, strapiWebhookMiddleware } from './middleware';
import { writeToDLQ } from './dlq';
import { validateCheckout, shippingCostFor, confirmationError } from './checkout';
import { hashToken } from './auth';
import { calculateDiscount } from './couponRoutes';
import { releasePendingTransactions } from './reservations';
import { syncInventoryProduct, decrementStrapiStock } from './inventory';

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
        available_qty = GREATEST(EXCLUDED.available_qty - commerce_inventory.reserved_qty - commerce_inventory.pending_sync_qty, 0),
        updated_at = CURRENT_TIMESTAMP
    `, [strapi_id, slug, name || slug, price || 0, stock ?? 0]);
    res.json({ success: true, message: `Inventory seeded for strapi_id=${strapi_id}, slug=${slug}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Debug: Release all stuck PENDING reservations immediately
// ----------------------------------------------------
router.post('/admin/release-stuck', adminApiKeyMiddleware, async (req, res) => {
  try {
    const rows = await releasePendingTransactions('all');
    res.json({ success: true, released: rows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

    let synced = 0;
    const results: any[] = [];
    let page = 1;
    let pageCount = 1;
    do {
      const response = await fetch(
        `${STRAPI_URL}/api/products?pagination[pageSize]=100&pagination[page]=${page}&publicationState=live`,
        { headers, signal: AbortSignal.timeout(15000) }
      );
      if (!response.ok) return res.status(502).json({ error: 'Strapi fetch failed' });
      const { data, meta } = await response.json();
      for (const product of data || []) {
        await syncInventoryProduct({ ...product.attributes, id: product.id });
        results.push({ strapi_id: product.id, slug: product.attributes.slug });
        synced++;
      }
      pageCount = meta?.pagination?.pageCount || 1;
      page++;
    } while (page <= pageCount);

    res.json({ success: true, synced, products: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ----------------------------------------------------
// Strapi Product Sync Webhook (Sprint 5 Product Mirror)
// ----------------------------------------------------
router.post('/sync/product', strapiWebhookMiddleware, async (req, res) => {
  const { event, model, entry } = req.body;

  if (model !== 'product' || !entry) {
    return res.status(400).json({ message: 'Irrelevant model' });
  }

  const { id: strapi_id, slug, title, price, stock, publishedAt } = entry;

  // We only sync published products natively
  if (event === 'entry.unpublish' || event === 'entry.delete' || !publishedAt || entry.status === 'archived') {
    await pool.query(`
      UPDATE commerce_inventory SET is_active = FALSE, strapi_updated_at = COALESCE($2::timestamptz, NOW())
      WHERE strapi_id = $1 AND (strapi_updated_at IS NULL OR strapi_updated_at <= COALESCE($2::timestamptz, NOW()))
    `, [strapi_id, entry.updatedAt || null]);
    return res.json({ success: true, action: 'deleted' });
  }

  try {
    await syncInventoryProduct(entry);
    res.json({ success: true, action: 'upserted' });
  } catch (error: any) {
    console.error('[ProductSync] Webhook upsert failed — writing to DLQ:', error.message);
    // ── DLQ: persist the failed event so it can be retried manually ───────────
    await writeToDLQ('product_sync', { event, model, entry }, error.message);
    // Respond 200 so Strapi doesn't retry the webhook in a tight loop
    res.status(200).json({ success: false, queued: true, message: 'Sync failed — event queued in DLQ' });
  }
});

// ----------------------------------------------------
// Initiate SSLCommerz Checkout & Pessimistic Lock
// ----------------------------------------------------
router.post('/payments/sslcommerz/initiate', checkoutLimiter, async (req, res) => {
  const transaction_id = randomUUID();

  let client;

  try {
    const { items, customer, couponCode, codVerificationToken } = validateCheckout(req.body);
    client = await pool.connect();
    await client.query('BEGIN');

    if (customer.paymentMethod === 'cod') {
      const proof = await client.query(`
        UPDATE commerce_otps SET verification_token_hash = NULL
        WHERE email = $1 AND purpose = 'cod' AND used = TRUE
          AND verification_token_hash = $2 AND expires_at > NOW()
        RETURNING id
      `, [customer.email, hashToken(codVerificationToken)]);
      if (proof.rowCount !== 1) throw new Error('Email verification expired or already used. Request a new code');
    }

    const orderItems: any[] = [];
    let subtotalCents = 0;

    const STRAPI_URL = process.env.STRAPI_URL || 'https://cms-driven-e-commerce.onrender.com';
    const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

    for (const item of items) {
      // Check if product exists in commerce_inventory
      const existsRes = await client.query(
        `SELECT available_qty FROM commerce_inventory WHERE strapi_id = $1`,
        [item.id]
      );

      // Bootstrap only missing rows. Zero stock may be reserved or sold while
      // the CMS still shows an older stock value.
      if (existsRes.rowCount === 0) {
        const strapiHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (STRAPI_TOKEN) strapiHeaders['Authorization'] = `Bearer ${STRAPI_TOKEN}`;

        const strapiRes = await fetch(`${STRAPI_URL}/api/products/${item.id}`, { headers: strapiHeaders, signal: AbortSignal.timeout(15000) });
        if (strapiRes.ok) {
          const productData = await strapiRes.json();
          const attrs = productData?.data?.attributes;
          if (attrs?.publishedAt && attrs.status !== 'archived') {
            const strapiStock = attrs.stock ?? 0;
            const slug = attrs.slug || `product-${item.id}`;
            const name = attrs.title || 'Unknown';
            const price = parseFloat(attrs.price) || 0;

            await client.query(`
              INSERT INTO commerce_inventory (strapi_id, slug, name, price, available_qty, reserved_qty)
              VALUES ($1, $2, $3, $4, $5, 0)
              ON CONFLICT (strapi_id) DO NOTHING
            `, [item.id, slug, name, price, strapiStock]);
          }
        }
      }

      // PESSIMISTIC LOCK: SKIP LOCKED
      const lockRes = await client.query(`
        SELECT available_qty, price, name, slug FROM commerce_inventory
        WHERE strapi_id = $1 AND is_active = TRUE AND available_qty >= $2
        FOR UPDATE SKIP LOCKED
      `, [item.id, item.quantity]);

      if (lockRes.rowCount === 0) {
        throw new Error(`Product ${item.id} is out of stock or currently locked by another checkout.`);
      }

      const product = lockRes.rows[0];
      const priceCents = Math.round(Number(product.price) * 100);
      if (!Number.isSafeInteger(priceCents) || priceCents < 0) throw new Error('Invalid product price');
      subtotalCents += priceCents * item.quantity;
      if (!Number.isSafeInteger(subtotalCents) || subtotalCents > 9999999999) throw new Error('Order total exceeds the checkout limit');
      orderItems.push({ id: item.id, quantity: item.quantity, price: priceCents / 100, title: product.name, slug: product.slug });

      await client.query(`
        UPDATE commerce_inventory 
        SET available_qty = available_qty - $2, 
            reserved_qty = reserved_qty + $2 
        WHERE strapi_id = $1
      `, [item.id, item.quantity]);
    }

    const subtotal = subtotalCents / 100;
    const shippingCost = shippingCostFor(customer.district);
    const baseTotal = Math.round((subtotal + shippingCost) * 100) / 100;

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
      discountAmount = calculateDiscount(coupon, baseTotal);
      discountAmount = Math.round(discountAmount * 100) / 100;

      // Atomically increment used_count
      await client.query(
        `UPDATE commerce_coupons SET used_count = used_count + 1 WHERE id = $1`,
        [coupon.id]
      );
      appliedCoupon = { code: coupon.code, type: coupon.type, value: parseFloat(coupon.value) };
    }

    // Final total after discount
    const finalTotal = Math.max(0, Math.round((baseTotal - discountAmount) * 100) / 100);

    // Set 15 minutes expiry to clear orphan reservations
    const customerWithMeta = { ...customer, subtotal, shippingCost, coupon: appliedCoupon, discountAmount };

    await client.query(`
      INSERT INTO commerce_transactions (transaction_id, status, total_amount, cart_items, customer_info, expires_at)
      VALUES ($1, 'PENDING', $2, $3, $4, NOW() + INTERVAL '15 minutes')
    `, [transaction_id, finalTotal, JSON.stringify(orderItems), JSON.stringify(customerWithMeta)]);

    await client.query('COMMIT');

    res.json({
      success: true, transaction_id,
      items: orderItems, subtotal, shippingCost, discountAmount, finalTotal,
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
router.post('/payments/ipn/sslcommerz', (_req, res) => {
  // Initiation is a local reservation, not a real SSLCommerz payment session.
  // Never accept caller-supplied payment status until server validation exists.
  res.status(503).json({ error: 'SSLCommerz payments are not configured' });
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
      transaction_id: tx.transaction_id,
      cartItems: items,
      totalAmount: parseFloat(tx.total_amount),
      status: 'confirmed',
      payment_method: 'cod',
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
      throw new Error(`Strapi order creation failed (${res.status}): ${text}`);
    } else {
      console.log('[Order] Strapi order created successfully');
    }
  } catch (err: any) {
    console.error('[Order] Could not create Strapi order:', err.message);
    await writeToDLQ('strapi_order_create', payload, err.message);
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
  let released = false;
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
    const invalid = confirmationError(tx, 'cod');
    if (invalid) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: invalid });
    }
    if (tx.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(200).json({ success: true, message: 'Already processed', status: tx.status, transaction_id });
    }

    const items = tx.cart_items;

    // Commit reserved stock (remove reservation, stock already decremented at lock time)
    for (const item of items) {
      await client.query(`
        UPDATE commerce_inventory 
        SET reserved_qty = GREATEST(reserved_qty - $2, 0),
            pending_sync_qty = pending_sync_qty + $2
        WHERE strapi_id = $1
      `, [item.id, item.quantity]);
    }

    await client.query(
      `UPDATE commerce_transactions SET status = 'COD_CONFIRMED' WHERE transaction_id = $1`,
      [transaction_id]
    );

    await client.query('COMMIT');
    client.release();
    released = true;

    // Create Strapi order + decrement stock (outside DB transaction, best-effort)
    await createStrapiOrder(tx, items);
    for (const item of items) {
      await decrementStrapiStock(item.id, item.quantity);
    }

    res.json({ success: true, message: 'COD order confirmed', transaction_id });

  } catch (err: any) {
    if (!released) await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    if (!released) client.release();
  }
});

// =====================================================
// bKash Manual Payment — customer sends money, submits TxnID
// Admin verifies in Strapi dashboard
// =====================================================
router.post('/payments/confirm-bkash', checkoutLimiter, async (req, res) => {
  const { transaction_id, bkash_txn_id } = req.body;
  if (!transaction_id) return res.status(400).json({ error: 'transaction_id required' });
  if (typeof bkash_txn_id !== 'string' || bkash_txn_id.trim().length < 4) {
    return res.status(400).json({ error: 'A valid bKash Transaction ID is required' });
  }

  const client = await pool.connect();
  let released = false;
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
    const invalid = confirmationError(tx, 'bkash');
    if (invalid) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: invalid });
    }
    if (tx.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(200).json({ success: true, message: 'Already processed', status: tx.status, transaction_id });
    }

    const items = tx.cart_items;

    // Commit reserved stock (same as COD — stock already decremented at lock time)
    for (const item of items) {
      await client.query(`
        UPDATE commerce_inventory 
        SET reserved_qty = GREATEST(reserved_qty - $2, 0),
            pending_sync_qty = pending_sync_qty + $2
        WHERE strapi_id = $1
      `, [item.id, item.quantity]);
    }

    // Store bKash TxnID in customer_info for admin reference
    const updatedCustomerInfo = {
      ...tx.customer_info,
      bkash_txn_id: bkash_txn_id.trim(),
      payment_method: 'bkash',
    };

    await client.query(
      `UPDATE commerce_transactions 
       SET status = 'PENDING_BKASH_VERIFICATION', customer_info = $2 
       WHERE transaction_id = $1`,
      [transaction_id, JSON.stringify(updatedCustomerInfo)]
    );

    await client.query('COMMIT');
    client.release();
    released = true;

    // Create Strapi order with bKash-specific fields
    const bkashTx = { ...tx, customer_info: updatedCustomerInfo };
    await createStrapiOrderBkash(bkashTx, items, bkash_txn_id.trim());
    for (const item of items) {
      await decrementStrapiStock(item.id, item.quantity);
    }

    res.json({
      success: true,
      message: 'Order placed — pending bKash payment verification',
      transaction_id,
      bkash_txn_id: bkash_txn_id.trim(),
    });

  } catch (err: any) {
    if (!released) await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    if (!released) client.release();
  }
});

// Helper: Create Strapi order with bKash payment metadata
async function createStrapiOrderBkash(tx: any, items: any[], bkashTxnId: string) {
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
      transaction_id: tx.transaction_id,
      cartItems: items,
      totalAmount: parseFloat(tx.total_amount),
      status: 'pending_verification',
      payment_method: 'bkash',
      bkash_txn_id: bkashTxnId,
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
      throw new Error(`Strapi order creation failed (${res.status}): ${text}`);
    } else {
      console.log('[Order:bKash] Strapi order created — pending verification');
    }
  } catch (err: any) {
    console.error('[Order:bKash] Could not create Strapi order:', err.message);
    await writeToDLQ('strapi_order_create', payload, err.message);
  }
}

export { router as commerceRoutes };

import { Router } from 'express';
import { pool } from './db';
import { adminApiKeyMiddleware, authLimiter } from './middleware';

export const couponRouter = Router();

// ─── Coupon calculation helper (exported for checkout use) ────────────────────
export function calculateDiscount(coupon: any, orderTotal: number): number {
  if (coupon.type === 'percentage') {
    const raw = (orderTotal * parseFloat(coupon.value)) / 100;
    // Cap at max_discount if set
    return coupon.max_discount ? Math.min(raw, parseFloat(coupon.max_discount)) : raw;
  }
  // Fixed: can't discount more than the order total
  return Math.min(parseFloat(coupon.value), orderTotal);
}

// ─── POST /coupons/validate ───────────────────────────────────────────────────
// Public endpoint — rate limited. Validates a code and returns the discount amount.
// Does NOT increment used_count — that only happens at order confirmation.
couponRouter.post('/validate', authLimiter, async (req, res) => {
  const { code, orderTotal } = req.body;
  if (!code || orderTotal == null) {
    return res.status(400).json({ error: 'code and orderTotal are required' });
  }

  const orderAmount = parseFloat(orderTotal);
  if (isNaN(orderAmount) || orderAmount <= 0) {
    return res.status(400).json({ error: 'orderTotal must be a positive number' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM commerce_coupons WHERE code = $1`,
      [code.trim().toUpperCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Coupon code not found' });
    }

    const coupon = rows[0];

    if (!coupon.is_active) {
      return res.status(400).json({ error: 'This coupon is no longer active' });
    }
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This coupon has expired' });
    }
    if (coupon.usage_limit !== null && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({ error: 'This coupon has reached its usage limit' });
    }
    if (parseFloat(coupon.min_order_amount) > 0 && orderAmount < parseFloat(coupon.min_order_amount)) {
      return res.status(400).json({
        error: `Minimum order amount for this coupon is Tk ${coupon.min_order_amount}`
      });
    }

    const discountAmount = Math.round(calculateDiscount(coupon, orderAmount) * 100) / 100;
    const finalTotal = Math.max(0, orderAmount - discountAmount);

    res.json({
      success: true,
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: parseFloat(coupon.value),
        max_discount: coupon.max_discount ? parseFloat(coupon.max_discount) : null,
      },
      discountAmount,
      finalTotal,
    });
  } catch (err: any) {
    console.error('[Coupon:Validate]', err.message);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
});

// ─── POST /admin/coupons ──────────────────────────────────────────────────────
// Admin: Create a new coupon
couponRouter.post('/admin', adminApiKeyMiddleware, async (req, res) => {
  const {
    code, type, value,
    min_order_amount = 0, max_discount = null,
    usage_limit = null, expires_at = null
  } = req.body;

  if (!code || !type || value == null) {
    return res.status(400).json({ error: 'code, type, and value are required' });
  }
  if (!['percentage', 'fixed'].includes(type)) {
    return res.status(400).json({ error: 'type must be "percentage" or "fixed"' });
  }
  if (type === 'percentage' && (parseFloat(value) <= 0 || parseFloat(value) > 100)) {
    return res.status(400).json({ error: 'percentage value must be between 1 and 100' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO commerce_coupons
        (code, type, value, min_order_amount, max_discount, usage_limit, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        code.trim().toUpperCase(), type, parseFloat(value),
        parseFloat(min_order_amount) || 0,
        max_discount ? parseFloat(max_discount) : null,
        usage_limit ? parseInt(usage_limit) : null,
        expires_at || null
      ]
    );
    res.status(201).json({ success: true, coupon: rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A coupon with this code already exists' });
    }
    console.error('[Coupon:Create]', err.message);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

// ─── GET /admin/coupons ───────────────────────────────────────────────────────
// Admin: List all coupons
couponRouter.get('/admin', adminApiKeyMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM commerce_coupons ORDER BY created_at DESC`
    );
    res.json({ success: true, count: rows.length, coupons: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /admin/coupons/:id/deactivate ─────────────────────────────────────
// Admin: Deactivate a coupon without deleting it
couponRouter.patch('/admin/:id/deactivate', adminApiKeyMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE commerce_coupons SET is_active = FALSE WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ success: true, coupon: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /admin/coupons/:id/activate ───────────────────────────────────────
// Admin: Re-activate a deactivated coupon
couponRouter.patch('/admin/:id/activate', adminApiKeyMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE commerce_coupons SET is_active = TRUE WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Coupon not found' });
    res.json({ success: true, coupon: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DLQ Admin Endpoints
// ─────────────────────────────────────────────────────────────────────────────

// GET /coupons/admin/dlq — list all unresolved DLQ events
couponRouter.get('/admin/dlq', adminApiKeyMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM commerce_dlq WHERE resolved = FALSE ORDER BY created_at DESC`
    );
    res.json({ success: true, count: rows.length, events: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /coupons/admin/dlq/all — list all DLQ events including resolved
couponRouter.get('/admin/dlq/all', adminApiKeyMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM commerce_dlq ORDER BY created_at DESC LIMIT 100`
    );
    res.json({ success: true, count: rows.length, events: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /coupons/admin/dlq/:id/resolve — mark a DLQ event as manually resolved
couponRouter.patch('/admin/dlq/:id/resolve', adminApiKeyMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE commerce_dlq SET resolved = TRUE WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'DLQ entry not found' });
    res.json({ success: true, event: rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

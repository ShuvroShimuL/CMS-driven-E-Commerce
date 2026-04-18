import { Router } from 'express';
import { pool } from './db';
import { authMiddleware } from './auth';

export const wishlistRouter = Router();

// All wishlist routes require authentication
wishlistRouter.use(authMiddleware);

// ─── GET /wishlist — List user's wishlist ──────────────────────────────────────
wishlistRouter.get('/', async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const { rows } = await pool.query(
      'SELECT product_strapi_id, product_slug, created_at FROM commerce_wishlists WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json({ items: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /wishlist/ids — Just the product IDs (for quick UI checks) ───────────
wishlistRouter.get('/ids', async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const { rows } = await pool.query(
      'SELECT product_strapi_id FROM commerce_wishlists WHERE user_id = $1',
      [userId]
    );
    res.json({ ids: rows.map(r => r.product_strapi_id) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /wishlist/toggle — Add or remove from wishlist ──────────────────────
wishlistRouter.post('/toggle', async (req, res) => {
  const userId = (req as any).user.id;
  const { product_strapi_id, product_slug } = req.body;

  if (!product_strapi_id || !product_slug) {
    return res.status(400).json({ error: 'product_strapi_id and product_slug are required' });
  }

  try {
    // Check if already in wishlist
    const existing = await pool.query(
      'SELECT id FROM commerce_wishlists WHERE user_id = $1 AND product_strapi_id = $2',
      [userId, product_strapi_id]
    );

    if (existing.rows.length > 0) {
      // Remove
      await pool.query(
        'DELETE FROM commerce_wishlists WHERE user_id = $1 AND product_strapi_id = $2',
        [userId, product_strapi_id]
      );
      res.json({ action: 'removed', product_strapi_id });
    } else {
      // Add
      await pool.query(
        'INSERT INTO commerce_wishlists (user_id, product_strapi_id, product_slug) VALUES ($1, $2, $3)',
        [userId, product_strapi_id, product_slug]
      );
      res.json({ action: 'added', product_strapi_id });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

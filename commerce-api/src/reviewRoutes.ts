import { Router } from 'express';
import { pool } from './db';
import { authMiddleware, JWTPayload } from './auth';
import { authLimiter } from './middleware';

export const reviewRouter = Router();

const STRAPI_URL   = process.env.STRAPI_URL   || 'https://cms-driven-e-commerce.onrender.com';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

function strapiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (STRAPI_TOKEN) h['Authorization'] = `Bearer ${STRAPI_TOKEN}`;
  return h;
}

// ─── GET /reviews/product/:productId ──────────────────────────────────────────
// Public — returns approved reviews + computed average for a product
reviewRouter.get('/product/:productId', async (req, res) => {
  const productId = parseInt(req.params.productId);
  if (isNaN(productId)) return res.status(400).json({ error: 'Invalid product ID' });

  try {
    const { rows } = await pool.query(
      `SELECT id, rating, comment, author_name, is_verified_purchase, created_at
       FROM commerce_reviews
       WHERE product_strapi_id = $1 AND is_approved = TRUE
       ORDER BY created_at DESC`,
      [productId]
    );

    // Compute average rating
    const count = rows.length;
    const average = count > 0
      ? Math.round((rows.reduce((sum: number, r: any) => sum + r.rating, 0) / count) * 10) / 10
      : 0;

    res.json({
      success: true,
      average,
      count,
      reviews: rows,
    });
  } catch (err: any) {
    console.error('[Reviews:Get]', err.message);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ─── POST /reviews ────────────────────────────────────────────────────────────
// Requires JWT. Checks for verified purchase. Creates in local DB (pending approval).
// Optionally mirrors to Strapi for admin moderation.
reviewRouter.post('/', authMiddleware, authLimiter, async (req, res) => {
  const user = (req as any).user as JWTPayload;
  const { productId, productSlug, rating, comment } = req.body;

  // Validation
  if (!productId || !productSlug || !rating || !comment) {
    return res.status(400).json({ error: 'productId, productSlug, rating, and comment are required' });
  }
  const ratingNum = parseInt(rating);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'rating must be between 1 and 5' });
  }
  if (comment.trim().length < 10) {
    return res.status(400).json({ error: 'Comment must be at least 10 characters' });
  }

  try {
    // Fetch user's display name
    const { rows: userRows } = await pool.query(
      `SELECT full_name FROM commerce_users WHERE id = $1`,
      [user.id]
    );
    const authorName = userRows[0]?.full_name || user.email.split('@')[0];

    // Check for duplicate review (same user + same product)
    const { rows: existing } = await pool.query(
      `SELECT id FROM commerce_reviews WHERE author_email = $1 AND product_strapi_id = $2`,
      [user.email, productId]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'You have already reviewed this product' });
    }

    // ── Verified Purchase check ──────────────────────────────────────────────
    // Look for a confirmed (PAID or COD_CONFIRMED) transaction containing this product
    const { rows: txRows } = await pool.query(
      `SELECT id FROM commerce_transactions
       WHERE status IN ('PAID', 'COD_CONFIRMED')
         AND customer_info->>'email' = $1
         AND EXISTS (
           SELECT 1 FROM jsonb_array_elements(cart_items) AS item
           WHERE (item->>'id')::int = $2
         )
       LIMIT 1`,
      [user.email, productId]
    );
    const isVerifiedPurchase = txRows.length > 0;

    // ── Insert into local DB ─────────────────────────────────────────────────
    const { rows: inserted } = await pool.query(
      `INSERT INTO commerce_reviews
        (product_strapi_id, product_slug, rating, comment, author_name, author_email, is_verified_purchase, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
       RETURNING *`,
      [productId, productSlug, ratingNum, comment.trim(), authorName, user.email, isVerifiedPurchase]
    );

    // ── Mirror to Strapi (async, best-effort — DLQ on failure) ───────────────
    try {
      await fetch(`${STRAPI_URL}/api/reviews`, {
        method: 'POST',
        headers: strapiHeaders(),
        body: JSON.stringify({
          data: {
            rating: ratingNum,
            comment: comment.trim(),
            author_name: authorName,
            author_email: user.email,
            product_strapi_id: productId,
            product_slug: productSlug,
            is_verified_purchase: isVerifiedPurchase,
            is_approved: false,
          }
        })
      });
    } catch (strapiErr: any) {
      // Non-fatal — review is saved locally
      console.warn('[Reviews:Strapi] Failed to mirror review to Strapi:', strapiErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted — pending admin approval',
      review: {
        id: inserted[0].id,
        rating: inserted[0].rating,
        comment: inserted[0].comment,
        author_name: inserted[0].author_name,
        is_verified_purchase: inserted[0].is_verified_purchase,
      }
    });
  } catch (err: any) {
    console.error('[Reviews:Create]', err.message);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// ─── GET /reviews/my ──────────────────────────────────────────────────────────
// Returns all reviews by the logged-in user (approved or not)
reviewRouter.get('/my', authMiddleware, async (req, res) => {
  const user = (req as any).user as JWTPayload;
  try {
    const { rows } = await pool.query(
      `SELECT id, product_strapi_id, product_slug, rating, comment, is_approved, is_verified_purchase, created_at
       FROM commerce_reviews WHERE author_email = $1 ORDER BY created_at DESC`,
      [user.email]
    );
    res.json({ success: true, count: rows.length, reviews: rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

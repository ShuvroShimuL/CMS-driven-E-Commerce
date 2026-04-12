import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from './db';
import { authMiddleware, signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from './auth';
import { sendOTPEmail, sendPasswordResetEmail } from './mailer';

export const userRouter = Router();

const STRAPI_URL  = process.env.STRAPI_URL        || 'https://cms-driven-e-commerce.onrender.com';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;
const FRONTEND_URL = process.env.FRONTEND_URL     || 'https://cms-driven-e-commerce.vercel.app';

function strapiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (STRAPI_TOKEN) h['Authorization'] = `Bearer ${STRAPI_TOKEN}`;
  return h;
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ─── POST /users/register ─────────────────────────────────────────────────────
userRouter.post('/register', async (req, res) => {
  const { email, password, full_name, phone } = req.body;
  if (!email || !password || !full_name)
    return res.status(400).json({ error: 'email, password and full_name are required' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const client = await pool.connect();
  try {
    const existing = await client.query(
      'SELECT id, is_verified FROM commerce_users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.rows.length > 0 && existing.rows[0].is_verified) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    if (existing.rows.length === 0) {
      const password_hash = await bcrypt.hash(password, 12);
      await client.query(
        'INSERT INTO commerce_users (email, password_hash, full_name, phone) VALUES ($1, $2, $3, $4)',
        [email.toLowerCase(), password_hash, full_name, phone || null]
      );
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await client.query(
      'INSERT INTO commerce_otps (email, otp_code, expires_at) VALUES ($1, $2, $3)',
      [email.toLowerCase(), otp, otpExpiry]
    );

    // Send OTP non-blocking — Gmail failure must NOT fail the registration
    sendOTPEmail(email, otp, full_name).catch(emailErr =>
      console.error('[Register] Gmail OTP send failed (non-fatal):', emailErr.message)
    );

    res.json({ success: true, message: 'OTP sent. Please check your email.' });
  } catch (err: any) {
    // Expose real DB error detail so we can diagnose (table missing, etc.)
    console.error('[Register] DB error:', err.message);
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  } finally { client.release(); }
});

// ─── POST /users/verify-otp ───────────────────────────────────────────────────
userRouter.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id FROM commerce_otps
       WHERE email = $1 AND otp_code = $2 AND used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase(), otp]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Invalid or expired OTP' });

    await client.query('UPDATE commerce_otps SET used = true WHERE id = $1', [rows[0].id]);

    const userRes = await client.query(
      'UPDATE commerce_users SET is_verified = true, updated_at = NOW() WHERE email = $1 RETURNING id, email, full_name, phone',
      [email.toLowerCase()]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userRes.rows[0];
    const accessToken  = signAccessToken(user.id, user.email);
    const refreshToken = signRefreshToken(user.id, user.email);
    const tokenHash    = hashToken(refreshToken);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      'INSERT INTO commerce_refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, refreshExpiry]
    );

    res.json({ success: true, accessToken, refreshToken, user });
  } catch (err: any) {
    console.error('[VerifyOTP]', err.message);
    res.status(500).json({ error: 'Verification failed' });
  } finally { client.release(); }
});

// ─── POST /users/resend-otp ───────────────────────────────────────────────────
userRouter.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT full_name FROM commerce_users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'No account found with this email' });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await client.query(
      'INSERT INTO commerce_otps (email, otp_code, expires_at) VALUES ($1, $2, $3)',
      [email.toLowerCase(), otp, otpExpiry]
    );
    await sendOTPEmail(email, otp, rows[0].full_name);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ─── POST /users/login ────────────────────────────────────────────────────────
userRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, email, password_hash, full_name, phone, is_verified FROM commerce_users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    if (!user.is_verified)
      return res.status(403).json({ error: 'Please verify your email before logging in', needsVerification: true, email: user.email });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const accessToken  = signAccessToken(user.id, user.email);
    const refreshToken = signRefreshToken(user.id, user.email);
    const tokenHash    = hashToken(refreshToken);
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      'INSERT INTO commerce_refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, refreshExpiry]
    );

    res.json({
      success: true, accessToken, refreshToken,
      user: { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone }
    });
  } catch (err: any) {
    console.error('[Login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  } finally { client.release(); }
});

// ─── POST /users/refresh ──────────────────────────────────────────────────────
userRouter.post('/refresh', async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Refresh token required in Authorization header' });

  let payload: { id: number; email: string };
  try { payload = verifyRefreshToken(header.slice(7)); }
  catch { return res.status(401).json({ error: 'Invalid or expired refresh token' }); }

  const tokenHash = hashToken(header.slice(7));
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id FROM commerce_refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
      [payload.id, tokenHash]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Refresh token revoked or expired' });

    await client.query('DELETE FROM commerce_refresh_tokens WHERE id = $1', [rows[0].id]);

    const newAccess  = signAccessToken(payload.id, payload.email);
    const newRefresh = signRefreshToken(payload.id, payload.email);
    const newHash    = hashToken(newRefresh);
    const newExpiry  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      'INSERT INTO commerce_refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [payload.id, newHash, newExpiry]
    );

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ─── POST /users/logout ───────────────────────────────────────────────────────
userRouter.post('/logout', authMiddleware, async (req, res) => {
  const user = (req as any).user;
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM commerce_refresh_tokens WHERE user_id = $1', [user.id]);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// ─── GET /users/me ────────────────────────────────────────────────────────────
userRouter.get('/me', authMiddleware, async (req, res) => {
  const user = (req as any).user;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT id, email, full_name, phone, created_at FROM commerce_users WHERE id = $1',
      [user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
  finally { client.release(); }
});

// ─── GET /users/orders ────────────────────────────────────────────────────────
userRouter.get('/orders', authMiddleware, async (req, res) => {
  const user = (req as any).user;
  try {
    const strapiRes = await fetch(
      `${STRAPI_URL}/api/orders?filters[email][$eq]=${encodeURIComponent(user.email)}&sort=createdAt:desc&pagination[pageSize]=50`,
      { headers: strapiHeaders() }
    );
    if (!strapiRes.ok) return res.status(502).json({ error: 'Failed to fetch orders' });
    const data = await strapiRes.json();
    res.json({ orders: data.data || [] });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ─── POST /users/merge-cart ───────────────────────────────────────────────────
userRouter.post('/merge-cart', authMiddleware, async (req, res) => {
  const user = (req as any).user;
  const { guestSessionId } = req.body;

  const client = await pool.connect();
  try {
    // Get user's saved cart session
    const { rows: userRows } = await client.query(
      'SELECT cart_session_id FROM commerce_users WHERE id = $1',
      [user.id]
    );
    const savedSessionId = userRows[0]?.cart_session_id as string | null;

    // Fetch guest cart items
    let guestItems: any[] = [];
    let guestCartId: number | null = null;
    if (guestSessionId) {
      const gRes = await fetch(
        `${STRAPI_URL}/api/carts?filters[sessionId][$eq]=${guestSessionId}`,
        { headers: strapiHeaders() }
      );
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData.data?.length > 0) {
          guestCartId = gData.data[0].id;
          guestItems = gData.data[0].attributes?.cartItems || [];
        }
      }
    }

    // Fetch user's existing cart
    let userCartId: number | null = null;
    let userItems: any[] = [];
    if (savedSessionId) {
      const uRes = await fetch(
        `${STRAPI_URL}/api/carts?filters[sessionId][$eq]=${savedSessionId}`,
        { headers: strapiHeaders() }
      );
      if (uRes.ok) {
        const uData = await uRes.json();
        if (uData.data?.length > 0) {
          userCartId = uData.data[0].id;
          userItems = uData.data[0].attributes?.cartItems || [];
        }
      }
    }

    // Merge: prefer higher quantities
    const merged = [...userItems];
    for (const gi of guestItems) {
      const idx = merged.findIndex((i: any) => i.id === gi.id);
      if (idx > -1) merged[idx].quantity += gi.quantity;
      else merged.push(gi);
    }

    const newSessionId = savedSessionId || crypto.randomUUID();

    if (userCartId) {
      await fetch(`${STRAPI_URL}/api/carts/${userCartId}`, {
        method: 'PUT',
        headers: strapiHeaders(),
        body: JSON.stringify({ data: { cartItems: merged, sessionId: newSessionId } })
      });
    } else if (merged.length > 0) {
      await fetch(`${STRAPI_URL}/api/carts`, {
        method: 'POST',
        headers: strapiHeaders(),
        body: JSON.stringify({ data: { sessionId: newSessionId, cartItems: merged } })
      });
    }

    // Persist session to user record
    await client.query(
      'UPDATE commerce_users SET cart_session_id = $1, updated_at = NOW() WHERE id = $2',
      [newSessionId, user.id]
    );

    res.json({ success: true, newSessionId });
  } catch (err: any) {
    console.error('[MergeCart]', err.message);
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ─── POST /users/forgot-password ─────────────────────────────────────────────
userRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      'SELECT full_name FROM commerce_users WHERE email = $1 AND is_verified = true',
      [email.toLowerCase()]
    );

    if (rows.length > 0) {
      const rawToken  = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await client.query(
        'INSERT INTO commerce_password_resets (email, token_hash, expires_at) VALUES ($1, $2, $3)',
        [email.toLowerCase(), tokenHash, expiresAt]
      );

      const resetUrl = `${FRONTEND_URL}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(email, resetUrl, rows[0].full_name);
    }

    // Always succeed to prevent email enumeration
    res.json({ success: true, message: 'If an account exists, a reset link has been sent.' });
  } catch (err: any) {
    console.error('[ForgotPassword]', err.message);
    res.status(500).json({ error: 'Failed to process request' });
  } finally { client.release(); }
});

// ─── POST /users/reset-password ──────────────────────────────────────────────
userRouter.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: 'token and newPassword are required' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const tokenHash = hashToken(token);
  const client = await pool.connect();
  try {
    // Look up email by token — no need for email in the URL
    const { rows } = await client.query(
      'SELECT id, email FROM commerce_password_resets WHERE token_hash = $1 AND used = false AND expires_at > NOW()',
      [tokenHash]
    );
    if (rows.length === 0)
      return res.status(400).json({ error: 'Reset link is invalid or has expired' });

    const email = rows[0].email;
    const passwordHash = await bcrypt.hash(newPassword, 12);
    const userRes = await client.query(
      'UPDATE commerce_users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id',
      [passwordHash, email]
    );
    if (userRes.rows.length === 0)
      return res.status(404).json({ error: 'Account not found' });

    await client.query('UPDATE commerce_password_resets SET used = true WHERE id = $1', [rows[0].id]);
    await client.query('DELETE FROM commerce_refresh_tokens WHERE user_id = $1', [userRes.rows[0].id]);

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err: any) {
    console.error('[ResetPassword]', err.message);
    res.status(500).json({ error: 'Password reset failed' });
  } finally { client.release(); }
});

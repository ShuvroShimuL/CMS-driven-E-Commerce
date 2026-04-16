import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// ─── Admin API Key Middleware ──────────────────────────────────────────────────
// Protects all /admin/* routes. Set ADMIN_API_KEY in Render env vars.
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';

export function adminApiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!ADMIN_API_KEY) {
    // If no key is configured, deny all access to prevent accidental exposure
    return res.status(503).json({ error: 'Admin API not configured' });
  }

  const provided = req.headers['x-admin-api-key'] as string | undefined;

  if (!provided || provided !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing admin API key' });
  }

  next();
}

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Auth: login, register, reset-password — 10 attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: { error: 'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// OTP: verify-otp, resend-otp, forgot-password — 5 attempts per 15 minutes per IP
// Conservative since these are the most abuse-prone vectors (account enumeration, OTP brute-force)
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  message: { error: 'Too many OTP requests. Please wait 15 minutes before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Checkout: initiate + confirm — 10 attempts per 15 minutes per IP
// Prevents cart flooding and inventory lock abuse
export const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  message: { error: 'Too many checkout attempts. Please try again shortly.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cart / Shipping: looser — 60 requests per minute per IP
// Allows normal browsing (adding/removing items, checking shipping rates)
export const cartLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

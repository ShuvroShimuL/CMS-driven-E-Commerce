import { Router } from 'express';
import crypto from 'crypto';
import { pool } from './db';
import { sendOTPEmail } from './mailer';
import { otpLimiter } from './middleware';
import { hashToken } from './auth';

export const otpRouter = Router();

const OTP_EXPIRY_MINUTES = 5;

/**
 * POST /otp/send-cod
 * Generates a 6-digit OTP, stores it in commerce_otps, and emails it.
 */
otpRouter.post('/send-cod', otpLimiter, async (req, res) => {
  try {
    const { email, name } = req.body;
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing unused OTPs for this email
    await pool.query(
      `UPDATE commerce_otps SET used = TRUE, verification_token_hash = NULL WHERE email = $1 AND purpose = 'cod'`,
      [email.trim().toLowerCase()]
    );

    // Insert new OTP
    await pool.query(
      `INSERT INTO commerce_otps (email, otp_code, expires_at, purpose) VALUES ($1, $2, $3, 'cod')`,
      [email.trim().toLowerCase(), code, expiresAt]
    );

    await sendOTPEmail(email, code, name || 'there');

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[COD OTP] Send failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to send verification code.' });
  }
});

/**
 * POST /otp/verify-cod
 * Validates a COD OTP against the database.
 */
otpRouter.post('/verify-cod', otpLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    if (typeof email !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Email and a six-digit code are required' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const result = await pool.query(
      `UPDATE commerce_otps SET used = TRUE, verification_token_hash = $3,
         expires_at = NOW() + INTERVAL '15 minutes'
       WHERE id = (
         SELECT id FROM commerce_otps WHERE email = $1 AND purpose = 'cod'
         ORDER BY created_at DESC, id DESC LIMIT 1
       ) AND used = FALSE AND otp_code = $2 AND expires_at > NOW()
       RETURNING id`,
      [email.trim().toLowerCase(), code, hashToken(verificationToken)]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or expired code. Please request a new code.' });
    }

    return res.json({ success: true, verificationToken });
  } catch (err: any) {
    console.error('[COD OTP] Verify failed:', err.message);
    return res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

import { Router } from 'express';
import crypto from 'crypto';
import { pool } from './db';
import { sendOTPEmail } from './mailer';

export const otpRouter = Router();

const OTP_EXPIRY_MINUTES = 5;

/**
 * POST /otp/send-cod
 * Generates a 6-digit OTP, stores it in commerce_otps, and emails it.
 */
otpRouter.post('/send-cod', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate any existing unused OTPs for this email
    await pool.query(
      `UPDATE commerce_otps SET used = TRUE WHERE email = $1 AND used = FALSE`,
      [email.toLowerCase()]
    );

    // Insert new OTP
    await pool.query(
      `INSERT INTO commerce_otps (email, otp_code, expires_at) VALUES ($1, $2, $3)`,
      [email.toLowerCase(), code, expiresAt]
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
otpRouter.post('/verify-cod', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, error: 'Email and code are required' });

    const result = await pool.query(
      `SELECT id, otp_code, expires_at FROM commerce_otps
       WHERE email = $1 AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'No OTP found. Please request a new code.' });
    }

    const row = result.rows[0];

    if (new Date() > new Date(row.expires_at)) {
      await pool.query(`UPDATE commerce_otps SET used = TRUE WHERE id = $1`, [row.id]);
      return res.json({ success: false, error: 'Code expired. Please request a new one.' });
    }

    if (row.otp_code !== code) {
      return res.json({ success: false, error: 'Incorrect code.' });
    }

    // Mark as used (one-time)
    await pool.query(`UPDATE commerce_otps SET used = TRUE WHERE id = $1`, [row.id]);

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[COD OTP] Verify failed:', err.message);
    return res.status(500).json({ success: false, error: 'Verification failed.' });
  }
});

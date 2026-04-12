import nodemailer from 'nodemailer';

// ─────────────────────────────────────────────────────────────────────────────
// Gmail SMTP Transport (for OTP & password reset)
// ─────────────────────────────────────────────────────────────────────────────
const gmailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const FROM_NAME = 'Premium Store';
const FROM_ADDR = process.env.GMAIL_USER || 'shamimrshimul0403@gmail.com';

export async function sendOTPEmail(to: string, otp: string, name: string = 'there') {
  if (!process.env.GMAIL_USER) {
    console.warn('[Mailer] GMAIL_USER not set — skipping OTP email');
    return;
  }
  await gmailTransport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDR}>`,
    to,
    subject: `${otp} — Your Premium Store Verification Code`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#7c3aed;margin-bottom:8px">Verify your email</h2>
        <p style="color:#444">Hi <strong>${name}</strong>,</p>
        <p style="color:#444">Enter the code below in the app to confirm your account. 
        This code expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f4f4f5;border-radius:8px;padding:24px;text-align:center;margin:24px 0">
          <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#7c3aed">${otp}</span>
        </div>
        <p style="color:#666;font-size:13px">If you didn't create a Premium Store account, ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Premium Store · Powered by Antigravity</p>
      </div>
    `
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string, name: string = 'there') {
  if (!process.env.GMAIL_USER) {
    console.warn('[Mailer] GMAIL_USER not set — skipping password reset email');
    return;
  }
  await gmailTransport.sendMail({
    from: `"${FROM_NAME}" <${FROM_ADDR}>`,
    to,
    subject: 'Reset your Premium Store password',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
        <h2 style="color:#7c3aed;margin-bottom:8px">Reset your password</h2>
        <p style="color:#444">Hi <strong>${name}</strong>,</p>
        <p style="color:#444">We received a request to reset your password. 
        Click the button below — this link expires in <strong>1 hour</strong>.</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${resetUrl}"
             style="background:#7c3aed;color:#fff;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">
            Reset Password
          </a>
        </div>
        <p style="color:#666;font-size:13px">
          If the button doesn't work, copy this link:<br/>
          <a href="${resetUrl}" style="color:#7c3aed;word-break:break-all">${resetUrl}</a>
        </p>
        <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
        <p style="color:#999;font-size:12px">Premium Store · Powered by Antigravity</p>
      </div>
    `
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Brevo Helpers (for payment + order lifecycle emails from commerce-api)
// ─────────────────────────────────────────────────────────────────────────────
const BREVO_KEY = process.env.BREVO_API_KEY || '';
const BREVO_SENDER = process.env.BREVO_SENDER_EMAIL || 'shamimrshimul0403@gmail.com';

async function sendBrevoEmail(to: string, toName: string, subject: string, html: string) {
  if (!BREVO_KEY) { console.warn('[Brevo] BREVO_API_KEY not set'); return; }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: BREVO_SENDER },
        to: [{ email: to, name: toName }],
        subject,
        htmlContent: html
      })
    });
    if (!res.ok) console.error('[Brevo] Failed:', await res.text());
  } catch (e) {
    console.error('[Brevo] Request error:', e);
  }
}

export async function sendPaymentConfirmedEmail(
  to: string, name: string, orderId: string, items: any[], total: number
) {
  const itemList = items.map((i: any) =>
    `<li>${i.title} × ${i.quantity} — $${(parseFloat(i.price) * i.quantity).toFixed(2)}</li>`
  ).join('');
  await sendBrevoEmail(to, name, `✅ Payment Confirmed #${orderId} — Premium Store`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#16a34a">✅ Payment Confirmed!</h2>
      <p>Hi <strong>${name}</strong>, your payment for order <strong>#${orderId}</strong> has been received.</p>
      <ul>${itemList}</ul>
      <p><strong>Total: $${total.toFixed(2)}</strong></p>
      <p>We are preparing your order for dispatch. Thank you for shopping with us!</p>
    </div>
  `);
}

export async function sendPaymentFailedEmail(
  to: string, name: string, orderId: string, retryUrl: string
) {
  await sendBrevoEmail(to, name, `❌ Payment Failed #${orderId} — Please Retry`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#dc2626">❌ Payment Failed</h2>
      <p>Hi <strong>${name}</strong>, unfortunately your payment for order <strong>#${orderId}</strong> was not successful.</p>
      <p>Please retry by clicking the button below:</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${retryUrl}" style="background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
          Retry Payment
        </a>
      </div>
      <p style="color:#666;font-size:13px">If you did not make this purchase, please ignore this email.</p>
    </div>
  `);
}

export async function sendOrderCancelledEmail(
  to: string, name: string, orderId: string
) {
  await sendBrevoEmail(to, name, `Order #${orderId} Cancelled — Premium Store`, `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="color:#dc2626">Order Cancelled</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your order <strong>#${orderId}</strong> has been automatically cancelled because 
         payment was not completed within 24 hours.</p>
      <p>Any reserved stock has been released. You are welcome to place a new order anytime.</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${process.env.FRONTEND_URL || 'https://cms-driven-e-commerce.vercel.app'}/category/all"
           style="background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold">
          Shop Again
        </a>
      </div>
    </div>
  `);
}

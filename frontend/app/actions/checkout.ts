'use server'

import { getCart, clearCart } from './cart';
import nodemailer from 'nodemailer';

const ADMIN_EMAIL  = process.env.ADMIN_EMAIL || '';
const GMAIL_USER   = process.env.GMAIL_USER || '';
const GMAIL_PASS   = process.env.GMAIL_APP_PASSWORD || '';
const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });
}

// ─── COD OTP: Send (Database-backed via Commerce API) ─────────────────────────
export async function sendCodOtp(email: string, name?: string) {
  try {
    const res = await fetch(`${COMMERCE_API}/otp/send-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to send verification code.' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('[COD OTP] Send failed:', err.message);
    return { success: false, error: 'Failed to send verification code. Please try again.' };
  }
}

// ─── COD OTP: Verify (Database-backed via Commerce API) ───────────────────────
export async function verifyCodOtp(email: string, code: string) {
  try {
    const res = await fetch(`${COMMERCE_API}/otp/verify-cod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json();
    return { success: res.ok && data.success, error: data.error, verificationToken: data.verificationToken };
  } catch {
    return { success: false, error: 'Verification failed. Please try again.' };
  }
}

// ─── Main Checkout ────────────────────────────────────────────────────────────
export async function processCheckout(formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const codVerificationToken = rawData.codVerificationToken;
    delete rawData.codVerificationToken;
    
    const cart = await getCart();
    const cartItems = cart?.attributes?.cartItems || [];

    if (cartItems.length === 0) throw new Error("Cart is empty");

    const couponCode = (rawData.couponCode as string || '').trim().toUpperCase() || undefined;
    const paymentMethod = (rawData.paymentMethod as string) || 'cod';
    const bkashTxnId = (rawData.bkashTxnId as string || '').trim();

    const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';

    // Step 1: Lock inventory
    const initRes = await fetch(`${COMMERCE_API}/payments/sslcommerz/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: cartItems, customer: rawData, couponCode, codVerificationToken })
    });

    if (!initRes.ok) {
      const contentType = initRes.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const errorData = await initRes.json();
        throw new Error(errorData.message || "Checkout failed — item may be out of stock.");
      } else {
        const textError = await initRes.text();
        console.error("Render HTML Error Dump:", textError);
        throw new Error("Unable to connect to Commerce API. Check Render logs.");
      }
    }

    const { transaction_id, items, subtotal, shippingCost, discountAmount, finalTotal, coupon } = await initRes.json();

    // Step 2: Confirm payment
    let confirmUrl: string;
    let confirmBody: Record<string, any>;

    if (paymentMethod === 'bkash') {
      confirmUrl = `${COMMERCE_API}/payments/confirm-bkash`;
      confirmBody = { transaction_id, bkash_txn_id: bkashTxnId };
    } else {
      confirmUrl = `${COMMERCE_API}/payments/confirm-cod`;
      confirmBody = { transaction_id };
    }

    const confirmRes = await fetch(confirmUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(confirmBody)
    });

    if (!confirmRes.ok) {
      const err = await confirmRes.json();
      throw new Error(err.error || 'Order confirmation failed');
    }

    // Step 3: Clear the cart
    // The order is committed. A cart service outage must not invite a duplicate order.
    try { await clearCart(); }
    catch (error) { console.error('[Checkout] Could not clear the completed cart:', error); }

    const shortId = transaction_id.slice(0, 8).toUpperCase();
    const customerName = rawData.fullName as string || 'Customer';
    const customerEmail = rawData.email as string || '';

    // Step 4: Send emails via Gmail
    const paymentLabel = paymentMethod === 'bkash' ? 'bKash' : 'Cash on Delivery';
    await Promise.allSettled([
      sendCustomerEmail(customerEmail, customerName, shortId, items, subtotal, shippingCost, rawData, paymentLabel, bkashTxnId, finalTotal),
      sendAdminEmail(customerName, customerEmail, shortId, items, subtotal, shippingCost, rawData, paymentLabel, bkashTxnId, finalTotal)
    ]);

    return { success: true, orderId: transaction_id, discountAmount, finalTotal, coupon };

  } catch (err: any) {
    console.error("Checkout process failed:", err.message);
    return { success: false, error: err.message };
  }
}


function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char] as string));
}

// ─── Customer Email (Gmail) ──────────────────────────────────────────────────
async function sendCustomerEmail(
  email: string, name: string, orderId: string,
  items: any[], subtotal: number, shippingCost: number, customer: any,
  paymentLabel: string, bkashTxnId: string, total: number
) {
  if (!GMAIL_USER || !GMAIL_PASS || !email) return;

  const itemRows = items.map((item: any) =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #222;color:#f5f5f5">${escapeHtml(item.title)}</td>
      <td style="padding:8px;border-bottom:1px solid #222;text-align:center;color:#a0a0a0">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #222;text-align:right;color:#f5f5f5">Tk ${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const isBkash = paymentLabel === 'bKash';
  const paymentNote = isBkash
    ? `<p style="background:#1a1a1a;padding:12px;border:1px solid rgba(226,19,110,0.3);color:#e2136e">
        <strong>Payment:</strong> bKash<br/>
        <strong>TxnID:</strong> ${escapeHtml(bkashTxnId)}<br/>
        <em style="color:#a0a0a0">Your payment is being verified.</em>
       </p>`
    : `<p style="color:#a0a0a0">You will pay the courier upon delivery. We'll dispatch your order shortly!</p>`;

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Premium Store" <${GMAIL_USER}>`,
      to: email,
      subject: `Order ${isBkash ? 'Received' : 'Confirmed'} #${orderId} — Premium Store`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#0a0a0a;color:#f5f5f5">
          <h2>🎉 Thank you, ${escapeHtml(name)}!</h2>
          <p>Your order <strong>#${orderId}</strong> has been ${isBkash ? 'received and is pending payment verification' : 'confirmed'}.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <thead><tr style="background:#1a1a1a">
              <th style="padding:8px;text-align:left;color:#a0a0a0;font-size:0.8rem">Product</th>
              <th style="padding:8px;color:#a0a0a0;font-size:0.8rem">Qty</th>
              <th style="padding:8px;text-align:right;color:#a0a0a0;font-size:0.8rem">Subtotal</th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
            <tfoot><tr>
              <td colspan="2" style="padding:8px;font-weight:bold;border-top:1px solid #222">Total</td>
              <td style="padding:8px;text-align:right;font-weight:bold;border-top:1px solid #222">Tk ${total.toFixed(2)}</td>
            </tr></tfoot>
          </table>
          <p><strong>Delivery Address:</strong><br/>
            <span style="color:#a0a0a0">${escapeHtml(customer.fullAddress)}, ${escapeHtml(customer.thana)}, ${escapeHtml(customer.district)}, ${escapeHtml(customer.division)}</span>
          </p>
          ${paymentNote}
          <hr style="border:none;border-top:1px solid #222;margin:24px 0"/>
          <p style="color:#666;font-size:12px">Premium Store · Powered by Antigravity</p>
        </div>
      `
    });
  } catch (e: any) {
    console.error("[Checkout] Customer email failed:", e.message);
  }
}

// ─── Admin Email (Gmail) ─────────────────────────────────────────────────────
async function sendAdminEmail(
  customerName: string, customerEmail: string, orderId: string,
  items: any[], subtotal: number, shippingCost: number, customer: any,
  paymentLabel: string, bkashTxnId: string, total: number
) {
  if (!GMAIL_USER || !GMAIL_PASS || !ADMIN_EMAIL) return;

  const isBkash = paymentLabel === 'bKash';
  const itemList = items.map((item: any) =>
    `<li>${escapeHtml(item.title)} × ${item.quantity} — Tk ${(parseFloat(item.price) * item.quantity).toFixed(2)}</li>`
  ).join('');

  const bkashBlock = isBkash
    ? `<div style="background:rgba(226,19,110,0.1);padding:12px;margin:12px 0;border:1px solid #e2136e">
        <strong style="color:#e2136e">⚠️ bKash — Verification Required</strong><br/>
        <strong>TxnID:</strong> ${escapeHtml(bkashTxnId)}<br/>
        <em>Verify in bKash app, then update order status in Strapi.</em>
       </div>`
    : '';

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Premium Store" <${GMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `${isBkash ? '🔔 bKash Verify' : '🛒 COD Order'} #${orderId} — Tk ${total.toFixed(2)}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:2px solid ${isBkash ? '#e2136e' : '#f5f5f5'}">
          <h2 style="color:${isBkash ? '#e2136e' : '#333'}">New Order Received!</h2>
          <p><strong>Order ID:</strong> #${orderId}</p>
          <p><strong>Total:</strong> Tk ${total.toFixed(2)}</p>
          <p><strong>Payment:</strong> ${paymentLabel}</p>
          ${bkashBlock}
          <hr/>
          <h3>Customer Details</h3>
          <p>
            <strong>Name:</strong> ${escapeHtml(customerName)}<br/>
            <strong>Email:</strong> ${escapeHtml(customerEmail)}<br/>
            <strong>Phone:</strong> ${escapeHtml(customer.phone)}<br/>
            <strong>Address:</strong> ${escapeHtml(customer.fullAddress)}, ${escapeHtml(customer.thana)}, ${escapeHtml(customer.district)}, ${escapeHtml(customer.division)}
          </p>
          <hr/>
          <h3>Items</h3>
          <ul>${itemList}</ul>
        </div>
      `
    });
  } catch (e: any) {
    console.error("[Checkout] Admin email failed:", e.message);
  }
}

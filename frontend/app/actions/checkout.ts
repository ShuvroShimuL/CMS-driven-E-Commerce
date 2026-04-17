'use server'

import { getCart, clearCart } from './cart';

const BREVO_KEY = process.env.BREVO_API_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'shamimrshimul0403@gmail.com';
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'shamimrshimul0403@gmail.com';

/**
 * Handles order creation: locks inventory, confirms payment (COD or bKash), creates Strapi order, sends emails.
 */
export async function processCheckout(formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    
    const cart = await getCart();
    const items = cart?.attributes?.cartItems || [];

    if (items.length === 0) throw new Error("Cart is empty");

    const subtotal = items.reduce(
      (acc: number, item: any) => acc + (parseFloat(item.price) * item.quantity), 0
    );

    const district = (rawData.district as string || '').trim().toLowerCase();
    const isDhaka = district === 'dhaka' || district === 'dhaka city';
    const shippingCost = isDhaka ? 60 : 120;
    const totalAmount = subtotal + shippingCost;

    const couponCode = (rawData.couponCode as string || '').trim().toUpperCase() || undefined;
    const paymentMethod = (rawData.paymentMethod as string) || 'cod';
    const bkashTxnId = (rawData.bkashTxnId as string || '').trim();

    const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';

    // Step 1: Lock inventory (pessimistic lock) + apply coupon
    const initRes = await fetch(`${COMMERCE_API}/payments/sslcommerz/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, customer: rawData, subtotal, shippingCost, totalAmount, couponCode })
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

    const { transaction_id } = await initRes.json();

    // Step 2: Confirm payment based on method
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
    await clearCart();

    const shortId = transaction_id.slice(0, 8).toUpperCase();
    const customerName = rawData.fullName as string || 'Customer';
    const customerEmail = rawData.email as string || '';

    // Step 4: Send emails (awaited to prevent Serverless execution from freezing)
    const paymentLabel = paymentMethod === 'bkash' ? 'bKash' : 'Cash on Delivery';
    await Promise.allSettled([
      sendCustomerEmail(customerEmail, customerName, shortId, items, subtotal, rawData, paymentLabel, bkashTxnId),
      sendAdminEmail(customerName, customerEmail, shortId, items, subtotal, rawData, paymentLabel, bkashTxnId)
    ]);

    return { success: true, orderId: transaction_id };

  } catch (err: any) {
    console.error("Checkout process failed:", err.message);
    return { success: false, error: err.message };
  }
}


// ─────────────────────────────────────────────────────────────
// Customer confirmation email
// ─────────────────────────────────────────────────────────────
async function sendCustomerEmail(
  email: string, name: string, orderId: string,
  items: any[], total: number, customer: any,
  paymentLabel: string = 'Cash on Delivery', bkashTxnId: string = ''
) {
  if (!BREVO_KEY || !email) return;

  const itemRows = items.map((item: any) =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${item.title}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">Tk ${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
    </tr>`
  ).join('');

  const isBkash = paymentLabel === 'bKash';
  const paymentNote = isBkash
    ? `<p style="background:#fdf2f8;padding:12px;border-radius:8px;border:1px solid #f9a8d4">
        <strong>Payment:</strong> bKash<br/>
        <strong>bKash TxnID:</strong> ${bkashTxnId}<br/>
        <em>Your payment is being verified. We'll confirm your order shortly.</em>
       </p>`
    : `<p>You will pay the courier upon delivery. We'll dispatch your order shortly!</p>`;

  const payload = {
    sender: { name: "Premium Store", email: SENDER_EMAIL },
    to: [{ email, name }],
    subject: `Order ${isBkash ? 'Received' : 'Confirmed'} #${orderId} — Premium Store`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
        <h2 style="color:#7c3aed">🎉 Thank you, ${name}!</h2>
        <p>Your order <strong>#${orderId}</strong> has been ${isBkash ? 'received and is pending payment verification' : 'confirmed'}.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#f4f4f5">
              <th style="padding:8px;text-align:left">Product</th>
              <th style="padding:8px">Qty</th>
              <th style="padding:8px;text-align:right">Subtotal</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:8px;font-weight:bold">Total</td>
              <td style="padding:8px;text-align:right;font-weight:bold">Tk ${total.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <p><strong>Delivery Address:</strong><br/>
          ${customer.fullAddress}, ${customer.thana}, ${customer.district}, ${customer.division}
        </p>
        ${paymentNote}
        <p>Best regards,<br/><strong>Premium Store Team</strong></p>
      </div>
    `
  };

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Customer email failed:", e);
  }
}

// ─────────────────────────────────────────────────────────────
// Admin notification email (sent to store owner)
// ─────────────────────────────────────────────────────────────
async function sendAdminEmail(
  customerName: string, customerEmail: string, orderId: string,
  items: any[], total: number, customer: any,
  paymentLabel: string = 'Cash on Delivery', bkashTxnId: string = ''
) {
  if (!BREVO_KEY) return;

  const isBkash = paymentLabel === 'bKash';
  const itemList = items.map((item: any) =>
    `<li>${item.title} × ${item.quantity} — Tk ${(parseFloat(item.price) * item.quantity).toFixed(2)}</li>`
  ).join('');

  const bkashBlock = isBkash
    ? `<div style="background:#fdf2f8;padding:12px;border-radius:8px;margin:12px 0;border:1px solid #e2136e">
        <strong style="color:#e2136e">⚠️ bKash Payment — Verification Required</strong><br/>
        <strong>bKash TxnID:</strong> ${bkashTxnId}<br/>
        <em>Please verify this transaction in your bKash app, then update the order status in Strapi.</em>
       </div>`
    : '';

  const payload = {
    sender: { name: "Premium Store", email: SENDER_EMAIL },
    to: [{ email: ADMIN_EMAIL, name: "Admin" }],
    subject: `${isBkash ? '🔔 bKash Verification Needed' : '🛒 New COD Order'} #${orderId} — Tk ${total.toFixed(2)}`,
    htmlContent: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;border:2px solid ${isBkash ? '#e2136e' : '#7c3aed'};border-radius:8px">
        <h2 style="color:${isBkash ? '#e2136e' : '#7c3aed'}">New Order Received!</h2>
        <p><strong>Order ID:</strong> #${orderId}</p>
        <p><strong>Total:</strong> Tk ${total.toFixed(2)}</p>
        <p><strong>Payment:</strong> ${paymentLabel}</p>
        ${bkashBlock}
        <hr/>
        <h3>Customer Details</h3>
        <p>
          <strong>Name:</strong> ${customerName}<br/>
          <strong>Email:</strong> ${customerEmail}<br/>
          <strong>Phone:</strong> ${customer.phone}<br/>
          <strong>Address:</strong> ${customer.fullAddress}, ${customer.thana}, ${customer.district}, ${customer.division}
        </p>
        <hr/>
        <h3>Items Ordered</h3>
        <ul>${itemList}</ul>
        <hr/>
        <p>View and manage this order in your 
          <a href="https://cms-driven-e-commerce.onrender.com/admin" style="color:#7c3aed">
            Strapi Admin Dashboard → Orders
          </a>
        </p>
      </div>
    `
  };

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'api-key': BREVO_KEY },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Admin email failed:", e);
  }
}

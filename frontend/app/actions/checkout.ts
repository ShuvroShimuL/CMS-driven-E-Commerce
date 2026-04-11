'use server'

import { getCart, clearCart } from './cart';
import { fetchAPI } from '@/lib/api';

/**
 * Handles order creation and Brevo Email sending purely on the server.
 */
export async function processCheckout(formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries());
    
    // Fetch current cart items securely from DB via cookie session
    const cart = await getCart();
    const items = cart?.attributes?.cartItems || [];

    if (items.length === 0) {
      throw new Error("Cart is empty");
    }

    const subtotal = items.reduce((acc: number, item: any) => acc + (parseFloat(item.price) * item.quantity), 0);

    // Refactored for Sprint 5 Commerce Engine API
    // 1. Fetch to Commerce microservice, locking inventory and getting Gateway URL
    const COMMERCE_API = process.env.COMMERCE_API_URL || 'http://localhost:4000/api/v1';
    
    const initRes = await fetch(`${COMMERCE_API}/payments/sslcommerz/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        customer: rawData,
        subtotal
      })
    });

    if (!initRes.ok) {
      const contentType = initRes.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await initRes.json();
        throw new Error(errorData.message || "Checkout failed at Gateway level");
      } else {
        const textError = await initRes.text();
        console.error("Render HTML Error Dump:", textError);
        throw new Error("Unable to connect to Commerce API securely. Check Render logs.");
      }
    }

    const { transaction_id, gatewayUrl } = await initRes.json();

    // In a real SSLCommerz sequence, you DO NOT clear the cart or send Brevo emails here!
    // They are triggered solely by the Backend /ipn webhook ONLY whenever Payment = VALID!
    // For Sprint 5 integration testing, we just clear the session cart returning the redirect
    await clearCart();

    return { success: true, redirectUrl: gatewayUrl };

  } catch (err: any) {
    console.error("Checkout process failed:", err.message);
    return { success: false, error: err.message };
  }
}

async function sendConfirmationEmail(customerEmail: string, customerName: string, orderId: number, total: number) {
  const BREVO_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_KEY) {
    console.warn("Skipping email: BREVO_API_KEY is not defined");
    return;
  }

  const payload = {
    sender: { name: "Premium Store", email: process.env.BREVO_SENDER_EMAIL || "shamimrshimul0403@gmail.com" },
    to: [{ email: customerEmail, name: customerName }],
    bcc: [{ email: "shamimrshimul0403@gmail.com", name: "Admin" }],
    subject: `Order Confirmation #${orderId} - Premium Store`,
    htmlContent: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Thank you for your order, ${customerName}!</h2>
        <p>We have successfully received your Cash on Delivery order <strong>#${orderId}</strong>.</p>
        <p><strong>Total Amount:</strong> $${total.toFixed(2)}</p>
        <br/>
        <p>We are processing your order and will dispatch it shortly. You will pay the courier upon delivery.</p>
        <br/>
        <p>Best regards,<br/>Premium Store Team</p>
      </div>
    `
  };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': BREVO_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.text();
      console.error("Brevo API failed:", errData);
    }
  } catch (e) {
    console.error("Failed to fetch Brevo:", e);
  }
}

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

    // 1. Create Strapi Order
    const orderRes = await fetchAPI('/orders', {}, {
      method: 'POST',
      auth: false,
      cache: 'no-store',
      body: {
        data: {
          fullName: rawData.fullName,
          email: rawData.email,
          phone: rawData.phone,
          fullAddress: rawData.fullAddress,
          division: rawData.division,
          district: rawData.district,
          thana: rawData.thana,
          cartItems: items,
          totalAmount: subtotal,
          status: 'pending' // CoD Default
        }
      }
    });

    const orderId = orderRes?.data?.id;
    if (!orderId) throw new Error("Failed to generate order record");

    // 1.5 Deduct Stock from Products
    for (const item of items) {
      try {
        // Fetch current product to safely read current stock
        // We use default fetchAPI which includes the Authorization Token
        const productData = await fetchAPI(`/products/${item.id}`);
        if (productData?.data) {
          const currentStock = productData.data.attributes.stock || 0;
          const newStock = Math.max(0, currentStock - item.quantity);
          
          await fetchAPI(`/products/${item.id}`, {}, {
            method: 'PUT',
            body: {
              data: {
                stock: newStock
              }
            }
          });
        }
      } catch (e) {
        console.error("Failed to deduct stock for product", item.id, e);
      }
    }

    // 2. Fire Brevo Email (Fire & Forget or Await)
    await sendConfirmationEmail(rawData.email as string, rawData.fullName as string, orderId, subtotal);

    // 3. Clear Cart
    await clearCart();

    return { success: true, orderId };
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
    sender: { name: "Premium Store", email: "noreply@premiumstore.com" },
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

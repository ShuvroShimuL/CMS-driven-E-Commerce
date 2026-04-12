import cron from 'node-cron';
import { pool } from './db';
import { sendOrderCancelledEmail, sendPaymentConfirmedEmail, sendPaymentFailedEmail } from './mailer';

const FRONTEND_URL  = process.env.FRONTEND_URL || 'https://cms-driven-e-commerce.vercel.app';
const SSL_STORE_ID  = process.env.SSLCOMMERZ_STORE_ID;
const SSL_STORE_PWD = process.env.SSLCOMMERZ_STORE_PASSWORD;
const SSL_IS_LIVE   = process.env.SSLCOMMERZ_IS_LIVE === 'true';

// ─────────────────────────────────────────────────────────────────────────────
// Job 1: Release expired inventory locks (every 1 min)
// Releases reserved_qty back to available_qty for PENDING transactions past expires_at
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule('* * * * *', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, transaction_id, cart_items
      FROM commerce_transactions
      WHERE status = 'PENDING' AND expires_at < NOW()
    `);

    for (const tx of rows) {
      for (const item of tx.cart_items) {
        await client.query(`
          UPDATE commerce_inventory
          SET available_qty = available_qty + $2,
              reserved_qty  = GREATEST(reserved_qty - $2, 0)
          WHERE strapi_id = $1
        `, [item.id, item.quantity]);
      }
      await client.query(
        `UPDATE commerce_transactions SET status = 'CANCELLED_TIMEOUT' WHERE id = $1`,
        [tx.id]
      );
      console.log(`[Cron:Expiry] Released lock for expired tx ${tx.transaction_id}`);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Cron:Expiry] Error:', e);
  } finally { client.release(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Job 2: SSLCommerz Reconciliation (every 15 min)
// Queries SSLCommerz for PENDING transactions older than 10 min.
// STUB MODE: skips gracefully until SSLCOMMERZ_STORE_ID env var is set.
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule('*/15 * * * *', async () => {
  if (!SSL_STORE_ID || !SSL_STORE_PWD) {
    console.log('[Cron:SSLReconcile] SSLCOMMERZ_STORE_ID not set — stub mode, skipping');
    return;
  }

  const validationBase = SSL_IS_LIVE
    ? 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php'
    : 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';

  const client = await pool.connect();
  try {
    // Find PENDING transactions older than 10 min that haven't been resolved
    const { rows } = await client.query(`
      SELECT id, transaction_id, cart_items, customer_info, total_amount
      FROM commerce_transactions
      WHERE status = 'PENDING'
        AND created_at < NOW() - INTERVAL '10 minutes'
        AND expires_at > NOW()
    `);

    for (const tx of rows) {
      try {
        const url = `${validationBase}?merchant_id=${SSL_STORE_ID}&merchant_pass=${SSL_STORE_PWD}&tran_id=${tx.transaction_id}&format=json`;
        const sslRes = await fetch(url);
        if (!sslRes.ok) continue;

        const sslData = await sslRes.json();
        const customer = tx.customer_info || {};

        if (sslData.status === 'VALID' || sslData.status === 'VALIDATED') {
          // Mark PAID
          await client.query(
            `UPDATE commerce_transactions SET status = 'PAID' WHERE id = $1`,
            [tx.id]
          );
          // Release reserved_qty permanently (it stays decremented)
          for (const item of tx.cart_items) {
            await client.query(`
              UPDATE commerce_inventory
              SET reserved_qty = GREATEST(reserved_qty - $2, 0)
              WHERE strapi_id = $1
            `, [item.id, item.quantity]);
          }
          if (customer.email) {
            await sendPaymentConfirmedEmail(
              customer.email, customer.fullName || 'Customer',
              tx.transaction_id.slice(0, 8).toUpperCase(),
              tx.cart_items, parseFloat(tx.total_amount)
            );
          }
          console.log(`[Cron:SSLReconcile] Auto-confirmed PAID tx ${tx.transaction_id}`);

        } else if (sslData.status === 'FAILED' || sslData.status === 'CANCELLED') {
          // Release inventory
          for (const item of tx.cart_items) {
            await client.query(`
              UPDATE commerce_inventory
              SET available_qty = available_qty + $2,
                  reserved_qty  = GREATEST(reserved_qty - $2, 0)
              WHERE strapi_id = $1
            `, [item.id, item.quantity]);
          }
          await client.query(
            `UPDATE commerce_transactions SET status = 'PAYMENT_FAILED' WHERE id = $1`,
            [tx.id]
          );
          if (customer.email) {
            const retryUrl = `${FRONTEND_URL}/checkout`;
            await sendPaymentFailedEmail(
              customer.email, customer.fullName || 'Customer',
              tx.transaction_id.slice(0, 8).toUpperCase(), retryUrl
            );
          }
          console.log(`[Cron:SSLReconcile] Marked FAILED tx ${tx.transaction_id}`);
        }
      } catch (innerErr) {
        console.error(`[Cron:SSLReconcile] Error querying tx ${tx.transaction_id}:`, innerErr);
      }
    }
  } catch (e) {
    console.error('[Cron:SSLReconcile] Fatal error:', e);
  } finally { client.release(); }
});

// ─────────────────────────────────────────────────────────────────────────────
// Job 3: 24-hour Auto-Cancel (every 30 min)
// Cancels PENDING transactions older than 24h, releases stock, emails customer
// ─────────────────────────────────────────────────────────────────────────────
cron.schedule('*/30 * * * *', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`
      SELECT id, transaction_id, cart_items, customer_info
      FROM commerce_transactions
      WHERE status = 'PENDING'
        AND created_at < NOW() - INTERVAL '24 hours'
    `);

    for (const tx of rows) {
      for (const item of tx.cart_items) {
        await client.query(`
          UPDATE commerce_inventory
          SET available_qty = available_qty + $2,
              reserved_qty  = GREATEST(reserved_qty - $2, 0)
          WHERE strapi_id = $1
        `, [item.id, item.quantity]);
      }
      await client.query(
        `UPDATE commerce_transactions SET status = 'CANCELLED_24H' WHERE id = $1`,
        [tx.id]
      );

      const customer = tx.customer_info || {};
      if (customer.email) {
        await sendOrderCancelledEmail(
          customer.email,
          customer.fullName || 'Customer',
          tx.transaction_id.slice(0, 8).toUpperCase()
        );
      }
      console.log(`[Cron:24hCancel] Auto-cancelled tx ${tx.transaction_id}`);
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[Cron:24hCancel] Error:', e);
  } finally { client.release(); }
});

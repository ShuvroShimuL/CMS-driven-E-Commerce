import { Router } from 'express';
import { sendOrderShippedEmail } from './mailer';
import { writeToDLQ } from './dlq';

export const webhookRouter = Router();

const STRAPI_URL = process.env.STRAPI_URL || 'https://cms-driven-e-commerce.onrender.com';
const STRAPI_TOKEN = process.env.STRAPI_API_TOKEN;

const STEADFAST_API_KEY    = process.env.STEADFAST_API_KEY || '';
const STEADFAST_SECRET_KEY = process.env.STEADFAST_SECRET_KEY || '';
const STEADFAST_BASE_URL   = process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';
const FRONTEND_URL         = 'https://cms-driven-e-commerce.vercel.app';

function strapiHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (STRAPI_TOKEN) h['Authorization'] = `Bearer ${STRAPI_TOKEN}`;
  return h;
}

// ─── POST /webhooks/strapi ───────────────────────────────────────────────────
// Listens for Strapi "commerce-order" updates.
// DLQ failure scenarios:
//   1. steadfast_parcel — Steadfast API returned non-OK or missing tracking_code
//   2. strapi_order_patch — writing tracking_code back to Strapi failed
webhookRouter.post('/strapi', async (req, res) => {
  try {
    const { event, model, entry } = req.body;

    if (model !== 'commerce-order' || !entry) {
       // Return 200 so Strapi doesn't retry irrelevant webhooks
       return res.json({ success: true, message: 'Ignored: not a commerce-order' });
    }

    if (event === 'entry.update') {
       // Check if status just changed to 'processing' and we don't have a tracking code yet
       if (entry.status === 'processing' && !entry.tracking_code) {
          
          let trackingCode: string | null = null;

          // ── 1. Send data to Steadfast/Packzy Courier API ──────────────────
          if (STEADFAST_API_KEY && STEADFAST_SECRET_KEY) {
            console.log('[Webhook] Attempting to create parcel in Steadfast/Packzy for Order ID:', entry.id);
            
            const sfPayload = {
              invoice: entry.id.toString(),
              recipient_name: entry.customer_name || 'Customer',
              recipient_phone: entry.phone || '00000000000',
              recipient_address: entry.shipping_address || 'Address not provided',
              cod_amount: entry.total || 0,
              note: `Order ${entry.id}`
            };

            try {
              const sfRes = await fetch(`${STEADFAST_BASE_URL}/create_order`, {
                method: 'POST',
                headers: {
                  'Api-Key': STEADFAST_API_KEY,
                  'Secret-Key': STEADFAST_SECRET_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(sfPayload)
              });

              const sfData = await sfRes.json();
              
              if (sfRes.ok && sfData.consignment?.tracking_code) {
                trackingCode = sfData.consignment.tracking_code;
                console.log('[Webhook] Steadfast parcel created. Tracking Code:', trackingCode);
              } else {
                // ── DLQ Scenario 1: Steadfast API rejected or returned no tracking code ──
                const errMsg = `Steadfast API error: ${JSON.stringify(sfData)}`;
                console.error('[Webhook]', errMsg);
                await writeToDLQ('steadfast_parcel', {
                  order_id: entry.id,
                  order_status: entry.status,
                  payload: sfPayload,
                  steadfast_response: sfData,
                }, errMsg);
              }
            } catch (sfErr: any) {
              // ── DLQ Scenario 1b: Network error reaching Steadfast ─────────────────────
              const errMsg = `Steadfast fetch exception: ${sfErr.message}`;
              console.error('[Webhook]', errMsg);
              await writeToDLQ('steadfast_parcel', {
                order_id: entry.id,
                order_status: entry.status,
                payload: sfPayload,
              }, errMsg);
            }
          } else {
            console.warn('[Webhook] Steadfast API keys not configured. Skipping courier creation.');
          }

          // ── 2. Update Strapi Order with the tracking code (if obtained) ───
          if (trackingCode) {
            try {
              const patchRes = await fetch(`${STRAPI_URL}/api/commerce-orders/${entry.id}`, {
                method: 'PUT',
                headers: strapiHeaders(),
                body: JSON.stringify({
                  data: {
                    tracking_code: trackingCode,
                    courier_status: 'Parcel Created'
                  }
                })
              });

              if (!patchRes.ok) {
                const patchBody = await patchRes.text();
                // ── DLQ Scenario 2: Strapi patch failed — tracking code obtained but not saved ──
                const errMsg = `Strapi order PATCH failed (${patchRes.status}): ${patchBody}`;
                console.error('[Webhook]', errMsg);
                await writeToDLQ('strapi_order_patch', {
                  order_id: entry.id,
                  tracking_code: trackingCode,
                  courier_status: 'Parcel Created',
                }, errMsg);
              }
            } catch (patchErr: any) {
              // ── DLQ Scenario 2b: Network error reaching Strapi for patch ─────────────────
              const errMsg = `Strapi order PATCH exception: ${patchErr.message}`;
              console.error('[Webhook]', errMsg);
              await writeToDLQ('strapi_order_patch', {
                order_id: entry.id,
                tracking_code: trackingCode,
              }, errMsg);
            }
          }

          // ── 3. Send Order Shipped Email ────────────────────────────────────
          // Sent regardless of courier success — customer still needs shipping notice
          const codeToEmail = trackingCode || 'PENDING';
          const trackingLink = `${FRONTEND_URL}/track?orderId=${entry.id}`;
          
          await sendOrderShippedEmail(
             entry.customer_email || 'example@example.com',
             entry.customer_name || 'Customer',
             entry.id.toString(),
             trackingLink,
             codeToEmail
          );

          return res.json({ success: true, trackingCode });
       }
    }

    res.json({ success: true, message: 'Processed successfully without Courier actions.' });
  } catch (error: any) {
    console.error('[StrapiWebhook Error] ', error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

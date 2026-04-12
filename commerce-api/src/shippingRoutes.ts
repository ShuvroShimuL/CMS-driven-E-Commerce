import { Router } from 'express';
import { pool } from './db';

export const shippingRouter = Router();

const STEADFAST_API_KEY    = process.env.STEADFAST_API_KEY || '';
const STEADFAST_SECRET_KEY = process.env.STEADFAST_SECRET_KEY || '';
const STEADFAST_BASE_URL   = process.env.STEADFAST_BASE_URL || 'https://portal.packzy.com/api/v1';

const FALLBACK_SHIPPING_DHAKA   = parseInt(process.env.FALLBACK_SHIPPING_RATE_DHAKA || '60', 10);
const FALLBACK_SHIPPING_OUTSIDE = parseInt(process.env.FALLBACK_SHIPPING_RATE_OUTSIDE || '120', 10);

// Helper to determine if a district is inside Dhaka
function isInsideDhaka(cityOrDistrict: string): boolean {
  if (!cityOrDistrict) return false;
  const match = cityOrDistrict.trim().toLowerCase();
  return match === 'dhaka' || match === 'dhaka city';
}

// ─── GET /shipping/rates?district=... ───────────────────────────────────────────
shippingRouter.get('/rates', async (req, res) => {
  try {
    const district = req.query.district as string;
    
    // In the future, if Steadfast provides a dynamic rate API, call it here.
    // For now, we use the fallback logic required by the user.
    const cost = isInsideDhaka(district) ? FALLBACK_SHIPPING_DHAKA : FALLBACK_SHIPPING_OUTSIDE;
    const provider = 'Steadfast (Fallback)';

    res.json({
      success: true,
      shipping: { provider, cost, district }
    });
  } catch (err: any) {
    console.error('[ShippingRates]', err.message);
    res.status(500).json({ error: 'Failed to calculate shipping rates' });
  }
});

// ─── GET /shipping/tracking/:trackingCode ──────────────────────────────────────
shippingRouter.get('/tracking/:trackingCode', async (req, res) => {
  try {
    const { trackingCode } = req.params;

    if (!STEADFAST_API_KEY || !STEADFAST_SECRET_KEY) {
      return res.status(503).json({ error: 'Courier API not configured' });
    }

    // Typical Steadfast tracking status by tracking_code
    // Note: Packzy/Steadfast often uses /status_by_trackingcode/:code or /status_by_cid/:id
    const url = `${STEADFAST_BASE_URL}/status_by_trackingcode/${encodeURIComponent(trackingCode)}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Api-Key': STEADFAST_API_KEY,
        'Secret-Key': STEADFAST_SECRET_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Courier API returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    
    // Steadfast typically wraps response in data.delivery_status
    if (data.status === 200 && data.delivery_status) {
       return res.json({ success: true, tracking: data.delivery_status });
    }

    res.json({ success: true, tracking: data });
  } catch (err: any) {
    console.error('[ShippingTracking]', err.message);
    res.status(500).json({ error: 'Failed to fetch tracking data', message: err.message });
  }
});

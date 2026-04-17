/**
 * k6 Load Test — Sprint 8
 *
 * Two profiles selectable via K6_PROFILE env var:
 *
 *   BASELINE (default) — 50 VUs, free-tier Render
 *     k6 run k6-load-test.js
 *
 *   FULL — 1,000 VUs, requires paid Render tier
 *     K6_PROFILE=full k6 run k6-load-test.js
 *
 * Error counting philosophy:
 *   Only 5xx responses count as errors.
 *   4xx = expected (rate limited, out of stock, coupon rule failed, etc.)
 *   429 from rate limiters = CORRECT behaviour, not a failure.
 *
 * Install k6 (Windows):
 *   winget install k6 --source winget
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Config ───────────────────────────────────────────────────────────────────
const FRONTEND_URL = 'https://cms-driven-e-commerce.vercel.app';
const COMMERCE_URL = 'https://cms-driven-e-commerce-api.onrender.com/api/v1';

// ─── Custom metrics ───────────────────────────────────────────────────────────
const serverErrors = new Rate('server_errors');    // only 5xx
const rateLimited  = new Counter('rate_limited');  // 429s — proof rate limiters work
const checkoutP95  = new Trend('checkout_response_ms', true);

// ─── Load profiles ────────────────────────────────────────────────────────────
const BASELINE_STAGES = [
  { duration: '30s', target: 20 },
  { duration: '1m',  target: 50 },
  { duration: '2m',  target: 50 },
  { duration: '30s', target: 0  },
];
const FULL_STAGES = [
  { duration: '1m',  target: 200  },
  { duration: '1m',  target: 1000 },
  { duration: '3m',  target: 1000 },
  { duration: '1m',  target: 0    },
];

const isFull   = __ENV.K6_PROFILE === 'full';
const stages   = isFull ? FULL_STAGES : BASELINE_STAGES;
const p95limit = isFull ? 2000 : 3000;

export const options = {
  stages,
  thresholds: {
    // Only 5xx count as real failures — <1% allowed
    'server_errors':        ['rate<0.01'],
    'http_req_duration':    [`p(95)<${p95limit}`],
    'checkout_response_ms': [`p(95)<${p95limit + 1000}`],
  },
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Count 5xx as server errors; 429 is the rate limiter working correctly
function checkEndpoint(res, name) {
  const is5xx = res.status >= 500;
  const is429  = res.status === 429;
  check(res, { [`${name}: not 5xx`]: (r) => r.status < 500 });
  serverErrors.add(is5xx);
  if (is429) rateLimited.add(1);
}

// ─── Main virtual user flow ───────────────────────────────────────────────────
export default function () {

  // 1. Health check — commerce-api
  const health = http.get(`${COMMERCE_URL.replace('/api/v1', '')}/health`);
  checkEndpoint(health, 'health');
  sleep(0.2);

  // 2. Homepage — Vercel CDN, always a real route
  const home = http.get(`${FRONTEND_URL}/`);
  checkEndpoint(home, 'homepage');
  sleep(0.3);

  // 3. Cart page — Vercel CDN, confirmed real route
  const cart = http.get(`${FRONTEND_URL}/cart`);
  checkEndpoint(cart, 'cart_page');
  sleep(0.2);

  // 4. Shipping rates — GET with query param
  // Note: cartLimiter is 60 req/min per IP. Under load test (same IP),
  // 429 responses are expected and counted in rate_limited counter, not errors.
  const shipping = http.get(
    `${COMMERCE_URL}/shipping/rates?district=Dhaka`,
    { headers: JSON_HEADERS }
  );
  checkEndpoint(shipping, 'shipping_rates');
  sleep(0.2);

  // 5. Coupon validate — expects 200 (WELCOME10 valid for Tk1000 order)
  // authLimiter: 10 req/15min per IP → 429 after limit, not counted as error
  const coupon = http.post(
    `${COMMERCE_URL}/coupons/validate`,
    JSON.stringify({ code: 'WELCOME10', orderTotal: 1000 }),
    { headers: JSON_HEADERS }
  );
  checkEndpoint(coupon, 'coupon_validate');
  sleep(0.2);

  // 6. Checkout initiate — DB lock path
  // checkoutLimiter: 10 req/15min per IP → 429 after limit, expected under test
  // Product ID 99999 → 400 "out of stock", not a 5xx
  const checkoutStart = Date.now();
  const checkout = http.post(
    `${COMMERCE_URL}/payments/sslcommerz/initiate`,
    JSON.stringify({
      items: [{ id: 99999, name: 'Load Test Item', price: 500, quantity: 1 }],
      customer: {
        fullName: 'Load Test User',
        email: 'loadtest@example.com',
        phone: '01700000000',
        fullAddress: '123 Test Street',
        division: 'Dhaka',
        district: 'Dhaka',
        thana: 'Dhanmondi',
      },
      subtotal: 500,
      shippingCost: 60,
      totalAmount: 560,
    }),
    { headers: JSON_HEADERS }
  );
  checkoutP95.add(Date.now() - checkoutStart);
  checkEndpoint(checkout, 'checkout_initiate');

  sleep(1);
}

// ─── Summary output ───────────────────────────────────────────────────────────
export function handleSummary(data) {
  const errPct  = (data.metrics.server_errors?.values?.rate ?? 0) * 100;
  const p95ms   = data.metrics.http_req_duration?.values?.['p(95)'] ?? 0;
  const rps     = data.metrics.http_reqs?.values?.rate ?? 0;
  const limited = data.metrics.rate_limited?.values?.count ?? 0;
  const profile = __ENV.K6_PROFILE === 'full' ? 'FULL (1000 VU)' : 'BASELINE (50 VU)';

  console.log('\n╔══════════════════════════════════════════╗');
  console.log(  '║         Sprint 8 — k6 Load Test          ║');
  console.log(`║  Profile: ${profile}`.padEnd(43) + '║');
  console.log(  '╠══════════════════════════════════════════╣');
  console.log(`║  5xx error rate:  ${errPct.toFixed(2)}% (target <1%)`.padEnd(43) + '║');
  console.log(`║  p95 latency:     ${p95ms.toFixed(0)}ms (target <${isFull ? 2000 : 3000}ms)`.padEnd(43) + '║');
  console.log(`║  Throughput:      ${rps.toFixed(1)} req/s`.padEnd(43) + '║');
  console.log(`║  Rate-limited:    ${limited} req (429s — limiters working)`.padEnd(43) + '║');
  console.log(  '╚══════════════════════════════════════════╝\n');

  return { 'k6-summary.json': JSON.stringify(data, null, 2) };
}

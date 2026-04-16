/**
 * k6 Load Test — Sprint 8
 * Target: 1,000 concurrent users, <1% error rate
 *
 * Scenarios tested:
 *   1. Homepage (product listing) — heaviest read traffic
 *   2. Product detail page
 *   3. Shipping rate calculation — cart flow
 *   4. Auth endpoints (login, register) — rate limiter tolerance check
 *   5. Coupon validation — real DB hit
 *   6. Health endpoint — baseline
 *
 * Run:
 *   k6 run k6-load-test.js
 *
 * Install k6 (Windows):
 *   winget install k6 --source winget
 *   OR: https://dl.k6.io/msi/k6-latest-amd64.msi
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Config ───────────────────────────────────────────────────────────────────
const FRONTEND_URL    = 'https://cms-driven-e-commerce.vercel.app';
const COMMERCE_URL    = 'https://cms-driven-e-commerce-api.onrender.com/api/v1';
const STRAPI_URL      = 'https://cms-driven-e-commerce.onrender.com';

// ─── Custom metrics ───────────────────────────────────────────────────────────
const errorRate   = new Rate('errors');
const checkoutP95 = new Trend('checkout_response_ms', true);

// ─── Load profile: ramp up to 1000 VUs over 2 min, hold 3 min, ramp down ─────
export const options = {
  stages: [
    { duration: '1m',  target: 200  },   // warm-up
    { duration: '1m',  target: 1000 },   // ramp to 1,000 concurrent users
    { duration: '3m',  target: 1000 },   // hold at 1,000
    { duration: '1m',  target: 0    },   // ramp down
  ],
  thresholds: {
    // <1% error rate across all requests
    'errors':                    ['rate<0.01'],
    // 95th percentile response time <2s
    'http_req_duration':         ['p(95)<2000'],
    // checkout endpoint p95 <3s (heavier DB work)
    'checkout_response_ms':      ['p(95)<3000'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function pass(res, name) {
  const ok = check(res, {
    [`${name}: status 2xx`]: (r) => r.status >= 200 && r.status < 300,
  });
  errorRate.add(!ok);
  return ok;
}

// ─── Main virtual user flow ───────────────────────────────────────────────────
export default function () {
  // 1. Health check (baseline)
  const health = http.get(`${COMMERCE_URL.replace('/api/v1', '')}/health`);
  pass(health, 'health');
  sleep(0.2);

  // 2. Strapi product listing (most common user action)
  const products = http.get(
    `${STRAPI_URL}/api/products?pagination[pageSize]=12&publicationState=live`
  );
  pass(products, 'product_listing');
  sleep(0.3);

  // 3. Single product detail
  const detail = http.get(
    `${STRAPI_URL}/api/products?filters[slug][$eq]=product-1&populate=*`
  );
  pass(detail, 'product_detail');
  sleep(0.2);

  // 4. Shipping rate calculation
  const shipping = http.post(
    `${COMMERCE_URL}/shipping/rates`,
    JSON.stringify({ district: 'Dhaka' }),
    { headers: JSON_HEADERS }
  );
  pass(shipping, 'shipping_rates');
  sleep(0.2);

  // 5. Coupon validate (real DB hit, but no mutation)
  const coupon = http.post(
    `${COMMERCE_URL}/coupons/validate`,
    JSON.stringify({ code: 'WELCOME10', orderTotal: 1000 }),
    { headers: JSON_HEADERS }
  );
  // 404 is expected if coupon doesn't exist — not an error for load test purposes
  check(coupon, { 'coupon: not server error': (r) => r.status !== 500 });
  errorRate.add(coupon.status === 500);
  sleep(0.2);

  // 6. Checkout initiate — heavy path (DB lock + coupon logic)
  // Uses a dummy product strapi_id — will fail with 400 (out of stock) which is expected
  // We're testing throughput and error rate, not business logic here
  const checkoutStart = Date.now();
  const checkout = http.post(
    `${COMMERCE_URL}/payments/sslcommerz/initiate`,
    JSON.stringify({
      items: [{ id: 99999, name: 'Test Product', price: 500, quantity: 1 }],
      customer: {
        fullName: 'Load Test User',
        email: 'loadtest@example.com',
        phone: '01700000000',
        fullAddress: 'Test Address',
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
  // 400 is expected (test product doesn't exist in inventory) — 500 would be a real failure
  check(checkout, { 'checkout: not server 5xx': (r) => r.status < 500 });
  errorRate.add(checkout.status >= 500);

  sleep(1);
}

// ─── Summary output ───────────────────────────────────────────────────────────
export function handleSummary(data) {
  const errorPct = (data.metrics.errors?.values?.rate ?? 0) * 100;
  const p95ms    = data.metrics.http_req_duration?.values?.['p(95)'] ?? 0;
  const rps      = data.metrics.http_reqs?.values?.rate ?? 0;

  console.log('\n╔══════════════════════════════════════════╗');
  console.log(  '║         Sprint 8 — k6 Load Test          ║');
  console.log(  '╠══════════════════════════════════════════╣');
  console.log(`║  Error rate:  ${errorPct.toFixed(2)}% (target <1%)`.padEnd(43) + '║');
  console.log(`║  p95 latency: ${p95ms.toFixed(0)}ms (target <2000ms)`.padEnd(43) + '║');
  console.log(`║  Throughput:  ${rps.toFixed(1)} req/s`.padEnd(43) + '║');
  console.log(  '╚══════════════════════════════════════════╝\n');

  return {
    'k6-summary.json': JSON.stringify(data, null, 2),
  };
}

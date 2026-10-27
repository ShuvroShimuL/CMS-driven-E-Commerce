const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');
const { once } = require('node:events');

// No live credentials, database, mailer or CMS are used by this suite.
process.env.STRAPI_URL = 'https://cms.test';
process.env.STRAPI_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.ADMIN_API_KEY = 'test-admin-key';
process.env.JWT_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.FALLBACK_SHIPPING_RATE_DHAKA = '60';
process.env.FALLBACK_SHIPPING_RATE_OUTSIDE = '120';
const db = new PGlite();
const query = async (sql, params) => {
  const result = await db.query(sql, params);
  return { ...result, rowCount: result.rows.length || result.affectedRows || 0 };
};
const pool = { query, connect: async () => ({ query, release() {} }) };
require.cache[require.resolve('../dist/db')] = { exports: { pool } };
require.cache[require.resolve('../dist/mailer')] = { exports: { sendOTPEmail: async () => {} } };
const { runMigrations } = require('../dist/init');
const { commerceRoutes } = require('../dist/routes');
const { otpRouter } = require('../dist/otpRoutes');
const { userRouter } = require('../dist/userRoutes');
const { releasePendingTransactions } = require('../dist/reservations');
const { checkoutLimiter, otpLimiter, authLimiter } = require('../dist/middleware');
const { signRefreshToken, signAccessToken, hashToken, verifyAccessToken } = require('../dist/auth');
const { syncInventoryProduct } = require('../dist/inventory');

let server, base, cmsCalls, failOrder, failStock;
const nativeFetch = global.fetch;
global.fetch = async (url, options = {}) => {
  if (String(url).startsWith('http://127.0.0.1:')) return nativeFetch(url, options);
  assert.ok(String(url).startsWith('https://cms.test/'), `Unexpected external request: ${url}`);
  cmsCalls.push({ url: String(url), ...options });
  if (String(url).endsWith('/api/orders') && failOrder) return new Response('Unavailable', { status: 503 });
  if (String(url).includes('/api/products/') && failStock) return new Response('Unavailable', { status: 503 });
  return Response.json({ data: { id: 1, attributes: { title: 'CMS title', slug: 'product', price: '125.50', stock: 10, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } });
};

const customer = { fullName: 'Customer', email: 'buyer@example.com', phone: '01234567890', fullAddress: 'Address', district: 'Dhaka', paymentMethod: 'bkash' };
function checkout(overrides = {}) {
  return { items: [{ id: 1, quantity: 1, price: 0.01, title: 'Forged title' }], customer, totalAmount: 0.01, shippingCost: 0, ...overrides };
}
async function post(path, body, headers = {}) {
  const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
async function stock() { return (await query('SELECT * FROM commerce_inventory WHERE strapi_id = 1')).rows[0]; }
async function codProof(email = customer.email) {
  await query(`INSERT INTO commerce_otps (email, otp_code, expires_at, purpose) VALUES ($1, '123456', NOW() + INTERVAL '5 minutes', 'cod')`, [email]);
  const verified = await post('/otp/verify-cod', { email, code: '123456' });
  assert.equal(verified.status, 200);
  return verified.body.verificationToken;
}

before(async () => {
  await runMigrations();
  const app = express();
  app.use(express.json());
  app.use(commerceRoutes);
  app.use('/otp', otpRouter);
  app.use('/users', userRouter);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(async () => {
  for (const limiter of [checkoutLimiter, otpLimiter, authLimiter]) limiter.resetKey('127.0.0.1');
  await db.exec(`TRUNCATE commerce_transactions, commerce_inventory, commerce_otps, commerce_dlq, commerce_coupons RESTART IDENTITY`);
  await query(`INSERT INTO commerce_inventory (strapi_id, slug, name, price, available_qty) VALUES (1, 'product', 'Real product', 125.50, 10)`);
  cmsCalls = [];
  failOrder = false;
  failStock = false;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  global.fetch = nativeFetch;
  await db.close();
});

test('checkout ignores forged totals and stores canonical prices, names and combined quantities', async () => {
  const result = await post('/payments/sslcommerz/initiate', checkout({ items: [{ id: 1, quantity: 1, price: 0 }, { id: 1, quantity: 2, price: -10 }] }));
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.subtotal, 376.50);
  assert.equal(result.body.finalTotal, 436.50);
  assert.deepEqual(result.body.items, [{ id: 1, quantity: 3, price: 125.50, title: 'Real product', slug: 'product' }]);
  assert.equal((await stock()).available_qty, 7);
  assert.equal((await stock()).reserved_qty, 3);
  const tx = (await query('SELECT * FROM commerce_transactions')).rows[0];
  assert.equal(Number(tx.total_amount), 436.50);
});

test('invalid and empty carts cannot change inventory or create transactions', async () => {
  for (const items of [[], null, [{ id: 1, quantity: -2 }], [{ id: 1, quantity: 1.5 }], [{ id: '1', quantity: 1 }]]) {
    assert.equal((await post('/payments/sslcommerz/initiate', checkout({ items }))).status, 400);
  }
  assert.equal((await stock()).available_qty, 10);
  assert.equal((await query('SELECT * FROM commerce_transactions')).rowCount, 0);
});

test('sold-out inventory is not replenished from stale CMS stock during checkout', async () => {
  await query('UPDATE commerce_inventory SET available_qty = 0, reserved_qty = 10');
  assert.equal((await post('/payments/sslcommerz/initiate', checkout())).status, 400);
  assert.equal(cmsCalls.length, 0);
  assert.equal((await stock()).reserved_qty, 10);
});

test('missing inventory can still be bootstrapped from a published CMS product', async () => {
  await query('DELETE FROM commerce_inventory');
  const result = await post('/payments/sslcommerz/initiate', checkout());
  assert.equal(result.status, 200);
  assert.equal(result.body.finalTotal, 185.50);
  assert.equal((await stock()).available_qty, 9);
});

test('product webhook authenticates and subtracts active reservations', async () => {
  await query('UPDATE commerce_inventory SET available_qty = 7, reserved_qty = 3');
  const event = { model: 'product', event: 'entry.update', entry: { id: 1, slug: 'product', title: 'New title', price: 125.50, stock: 10, publishedAt: new Date().toISOString() } };
  assert.equal((await post('/sync/product', event)).status, 401);
  assert.equal((await post('/sync/product', event, { authorization: 'Bearer test-webhook-secret' })).status, 200);
  assert.equal((await stock()).available_qty, 7);
  assert.equal((await stock()).reserved_qty, 3);
});

test('unpublished products stay unavailable after reservations are released', async () => {
  const init = await post('/payments/sslcommerz/initiate', checkout());
  assert.equal(init.status, 200);
  await post('/sync/product', { model: 'product', event: 'entry.unpublish', entry: { id: 1 } }, { authorization: 'Bearer test-webhook-secret' });
  await releasePendingTransactions('all');
  assert.equal((await post('/payments/sslcommerz/initiate', checkout())).status, 400);
});

test('COD requires an email-bound verification token and consumes it once', async () => {
  const cod = { ...customer, paymentMethod: 'cod' };
  assert.equal((await post('/payments/sslcommerz/initiate', checkout({ customer: cod }))).status, 400);
  const proof = await codProof();
  assert.equal((await post('/payments/sslcommerz/initiate', checkout({ customer: { ...cod, email: 'other@example.com' }, codVerificationToken: proof }))).status, 400);
  const body = checkout({ customer: cod, codVerificationToken: proof });
  assert.equal((await post('/payments/sslcommerz/initiate', body)).status, 200);
  assert.equal((await post('/payments/sslcommerz/initiate', body)).status, 400);
});

test('account and COD verification codes cannot be exchanged or replayed', async () => {
  await query(`INSERT INTO commerce_otps (email, otp_code, expires_at, purpose) VALUES ($1, '111111', NOW() + INTERVAL '5 minutes', 'account')`, [customer.email]);
  assert.equal((await post('/otp/verify-cod', { email: customer.email, code: '111111' })).status, 400);
  await codProof();
  assert.equal((await post('/otp/verify-cod', { email: customer.email, code: '123456' })).status, 400);
  assert.equal((await post('/users/verify-otp', { email: customer.email, otp: '123456' })).status, 400);
});

test('coupon calculations use canonical totals and expiry refunds stock and coupon exactly once', async () => {
  await query(`INSERT INTO commerce_coupons (code, type, value, usage_limit) VALUES ('TEN', 'percentage', 10, 1)`);
  const result = await post('/payments/sslcommerz/initiate', checkout({ couponCode: 'ten' }));
  assert.equal(result.body.discountAmount, 18.55);
  assert.equal(result.body.finalTotal, 166.95);
  await query(`UPDATE commerce_transactions SET expires_at = NOW() - INTERVAL '1 minute'`);
  assert.equal((await releasePendingTransactions()).length, 1);
  assert.equal((await releasePendingTransactions()).length, 0);
  assert.equal((await stock()).available_qty, 10);
  assert.equal((await stock()).reserved_qty, 0);
  assert.equal((await query('SELECT used_count FROM commerce_coupons')).rows[0].used_count, 0);
  assert.equal((await post('/payments/confirm-bkash', { transaction_id: result.body.transaction_id, bkash_txn_id: 'TEST1234' })).status, 409);
});

test('unexpired and confirmed orders are not cancelled; confirmation is idempotent', async () => {
  const init = await post('/payments/sslcommerz/initiate', checkout());
  assert.equal((await releasePendingTransactions()).length, 0);
  const confirmation = { transaction_id: init.body.transaction_id, bkash_txn_id: 'TEST1234' };
  assert.equal((await post('/payments/confirm-bkash', confirmation)).status, 200);
  assert.equal((await post('/payments/confirm-bkash', confirmation)).status, 200);
  assert.equal(cmsCalls.filter(call => call.url.endsWith('/api/orders')).length, 1);
  const order = JSON.parse(cmsCalls.find(call => call.url.endsWith('/api/orders')).body).data;
  const schema = require('../../backend/src/api/order/content-types/order/schema.json').attributes;
  for (const field of Object.keys(order)) assert.ok(schema[field], `Missing CMS field ${field}`);
  assert.ok(schema.status.enum.includes(order.status));
  assert.equal(order.totalAmount, 185.50);
  assert.equal((await stock()).reserved_qty, 0);
  assert.equal((await releasePendingTransactions('all')).length, 0);
});

test('expired reservations and payment-method switches cannot be confirmed', async () => {
  const init = await post('/payments/sslcommerz/initiate', checkout());
  assert.equal((await post('/payments/confirm-cod', { transaction_id: init.body.transaction_id })).status, 409);
  await query(`UPDATE commerce_transactions SET expires_at = NOW() - INTERVAL '1 minute'`);
  assert.equal((await post('/payments/confirm-bkash', { transaction_id: init.body.transaction_id, bkash_txn_id: 'TEST1234' })).status, 409);
  assert.equal(cmsCalls.length, 0);
});

test('forged SSLCommerz callbacks cannot mark a transaction paid', async () => {
  const init = await post('/payments/sslcommerz/initiate', checkout());
  assert.equal((await post('/payments/ipn/sslcommerz', { tran_id: init.body.transaction_id, status: 'VALID', amount: 0.01 })).status, 503);
  assert.equal((await query('SELECT status FROM commerce_transactions')).rows[0].status, 'PENDING');
});

test('failed CMS order creation is recoverable from the DLQ', async () => {
  const init = await post('/payments/sslcommerz/initiate', checkout());
  failOrder = true;
  assert.equal((await post('/payments/confirm-bkash', { transaction_id: init.body.transaction_id, bkash_txn_id: 'TEST1234' })).status, 200);
  const event = (await query('SELECT * FROM commerce_dlq')).rows[0];
  assert.equal(event.event_type, 'strapi_order_create');
  assert.equal(event.payload.data.transaction_id, init.body.transaction_id);
});

test('CMS sync cannot restore sold stock when the CMS decrement fails', async () => {
  const init = await post('/payments/sslcommerz/initiate', checkout());
  failStock = true;
  assert.equal((await post('/payments/confirm-bkash', { transaction_id: init.body.transaction_id, bkash_txn_id: 'TEST1234' })).status, 200);
  assert.equal((await stock()).pending_sync_qty, 1);
  await syncInventoryProduct({ id: 1, slug: 'product', title: 'Edited title', price: 125.50, stock: 10, publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  assert.equal((await stock()).available_qty, 9);
  assert.equal((await stock()).pending_sync_qty, 1);
});

test('delayed CMS stock events cannot overwrite newer inventory', async () => {
  const entry = { id: 1, slug: 'product', title: 'Product', price: 125.50, publishedAt: '2025-01-01T00:00:00Z' };
  await syncInventoryProduct({ ...entry, stock: 5, updatedAt: '2026-01-02T00:00:00Z' });
  await syncInventoryProduct({ ...entry, stock: 10, updatedAt: '2026-01-01T00:00:00Z' });
  assert.equal((await stock()).available_qty, 5);
});

test('COD confirmation stays unpaid and uses a CMS-compatible order', async () => {
  const proof = await codProof();
  const init = await post('/payments/sslcommerz/initiate', checkout({ customer: { ...customer, paymentMethod: 'cod' }, codVerificationToken: proof }));
  assert.equal((await post('/payments/confirm-cod', { transaction_id: init.body.transaction_id })).status, 200);
  assert.equal((await query('SELECT status FROM commerce_transactions')).rows[0].status, 'COD_CONFIRMED');
  assert.equal((await stock()).pending_sync_qty, 0);
  assert.equal((await stock()).available_qty, 9);
});

test('migrations preserve old UTC expiry timestamps and can be repeated', async () => {
  await query(`ALTER TABLE commerce_transactions
    ALTER COLUMN expires_at TYPE TIMESTAMP USING expires_at AT TIME ZONE 'UTC',
    ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC'`);
  await query(`INSERT INTO commerce_transactions (transaction_id, total_amount, cart_items, expires_at)
    VALUES ('legacy', 10, '[]', '2026-01-01 12:00:00')`);
  await runMigrations();
  await runMigrations();
  assert.equal((await query(`SELECT expires_at FROM commerce_transactions WHERE transaction_id = 'legacy'`)).rows[0].expires_at.toISOString(), '2026-01-01T12:00:00.000Z');
});

test('JWT configuration fails closed and refresh tokens are unique', () => {
  assert.notEqual(signRefreshToken(1, customer.email), signRefreshToken(1, customer.email));
  const previous = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  try { assert.throws(() => verifyAccessToken('forged'), /must be configured/); }
  finally { process.env.JWT_SECRET = previous; }
});

test('logging in with the saved cart does not merge it into itself', async () => {
  const { rows } = await query(`INSERT INTO commerce_users (email, password_hash, cart_session_id)
    VALUES ('cart@example.com', 'unused', 'existing-session') RETURNING id`);
  const result = await post('/users/merge-cart', { guestSessionId: 'existing-session' }, {
    authorization: `Bearer ${signAccessToken(rows[0].id, 'cart@example.com')}`,
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.newSessionId, 'existing-session');
  assert.equal(cmsCalls.length, 0);
});

test('refresh token rotation rejects reuse of the previous token', async () => {
  const { rows } = await query(`INSERT INTO commerce_users (email, password_hash) VALUES ('refresh@example.com', 'unused') RETURNING id`);
  const token = signRefreshToken(rows[0].id, 'refresh@example.com');
  await query(`INSERT INTO commerce_refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')`, [rows[0].id, hashToken(token)]);
  const response = await post('/users/refresh', {}, { authorization: `Bearer ${token}` });
  assert.equal(response.status, 200);
  assert.notEqual(response.body.refreshToken, token);
  assert.equal((await post('/users/refresh', {}, { authorization: `Bearer ${token}` })).status, 401);
  assert.equal((await post('/users/refresh', {}, { authorization: `Bearer ${response.body.refreshToken}` })).status, 200);
});

 test('registration replaces an unverified password and verification requires the new password', async () => {
  const email = 'registration-security@example.test';
  await query('DELETE FROM commerce_users WHERE email = $1', [email]);
  assert.equal((await post('/users/register', { email, password: 'attacker-password', full_name: 'Attacker' })).status, 200);
  const oldOtp = (await query('SELECT otp_code FROM commerce_otps WHERE email = $1 ORDER BY id DESC LIMIT 1', [email])).rows[0].otp_code;
  assert.equal((await post('/users/register', { email, password: 'customer-password', full_name: 'Customer' })).status, 200);
  const otp = (await query('SELECT otp_code FROM commerce_otps WHERE email = $1 ORDER BY id DESC LIMIT 1', [email])).rows[0].otp_code;
  assert.equal((await post('/users/verify-otp', { email, otp: oldOtp, password: 'attacker-password' })).status, 400);
  assert.equal((await post('/users/verify-otp', { email, otp, password: 'attacker-password' })).status, 400);
  assert.equal((await post('/users/verify-otp', { email, otp, password: 'customer-password' })).status, 200);
  assert.equal((await post('/users/verify-otp', { email, otp, password: 'customer-password' })).status, 400);
  assert.equal((await post('/users/resend-otp', { email })).status, 404);
  assert.equal((await post('/users/login', { email, password: 'attacker-password' })).status, 401);
  assert.equal((await post('/users/login', { email, password: 'customer-password' })).status, 200);
});

test('password reset consumes the token and invalidates other reset links', async () => {
  const email = 'reset-security@example.test';
  await query('DELETE FROM commerce_users WHERE email = $1', [email]);
  await query(`INSERT INTO commerce_users (email, password_hash, is_verified) VALUES ($1, 'unused', true)`, [email]);
  const first = 'a'.repeat(64), second = 'b'.repeat(64);
  await query(`INSERT INTO commerce_password_resets (email, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour'), ($1, $3, NOW() + INTERVAL '1 hour')`, [email, hashToken(first), hashToken(second)]);
  assert.equal((await post('/users/reset-password', { token: first, newPassword: 'new-password' })).status, 200);
  assert.equal((await post('/users/reset-password', { token: first, newPassword: 'another-password' })).status, 400);
  assert.equal((await post('/users/reset-password', { token: second, newPassword: 'another-password' })).status, 400);
  assert.equal((await post('/users/login', { email, password: 'new-password' })).status, 200);
});

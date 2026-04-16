// Quick sanity check for rate limiting & admin auth
const BASE = 'https://cms-driven-e-commerce-api.onrender.com/api/v1';
const ADMIN_KEY = process.argv[2]; // pass as arg: node test-security.js <key>

async function test(label, url, options = {}) {
  try {
    const res = await fetch(url, options);
    const body = await res.text();
    const icon = res.status < 400 ? '✅' : res.status === 401 ? '🔒' : res.status === 429 ? '🚫' : '❌';
    console.log(`${icon} [${res.status}] ${label}`);
    if (res.status >= 400) console.log(`   → ${body.slice(0, 120)}`);
  } catch (e) {
    console.log(`❌ [ERR] ${label}: ${e.message}`);
  }
}

(async () => {
  console.log('\n=== Admin Route Protection ===');
  await test('GET /admin/inventory  (no key)   → expect 401', `${BASE}/admin/inventory`);
  await test('GET /admin/inventory  (wrong key) → expect 401', `${BASE}/admin/inventory`, {
    headers: { 'x-admin-api-key': 'wrong-key' }
  });
  await test('GET /admin/inventory  (correct)  → expect 200', `${BASE}/admin/inventory`, {
    headers: { 'x-admin-api-key': ADMIN_KEY }
  });

  console.log('\n=== Health Check ===');
  await test('GET /health → sprint should be 8', 'https://cms-driven-e-commerce-api.onrender.com/health');

  console.log('\n=== OTP Rate Limiting (5/15min) ===');
  console.log('   Sending 6 forgot-password requests to trigger limiter...');
  for (let i = 1; i <= 6; i++) {
    await test(`POST /users/forgot-password [${i}/6] → expect 429 on 6th`, `${BASE}/users/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'limitertest@example.com' })
    });
  }
})();

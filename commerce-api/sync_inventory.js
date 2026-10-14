require('dotenv').config();
const api = process.env.COMMERCE_API_URL;
const key = process.env.ADMIN_API_KEY;
if (!api || !key) throw new Error('COMMERCE_API_URL and ADMIN_API_KEY must be configured');

fetch(`${api.replace(/\/$/, '')}/admin/sync-from-strapi`, {
  method: 'POST',
  headers: { 'x-admin-api-key': key }
}).then(async response => {
  if (!response.ok) throw new Error(`Inventory sync failed (${response.status})`);
  const result = await response.json();
  console.log(`Synced ${result.synced} products.`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });

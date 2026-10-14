require('dotenv').config();
require('ts-node/register');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be configured');
const { pool } = require('./src/db');
const { releasePendingTransactions } = require('./src/reservations');

releasePendingTransactions('all')
  .then(rows => console.log(`Released ${rows.length} pending transactions.`))
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => pool.end());

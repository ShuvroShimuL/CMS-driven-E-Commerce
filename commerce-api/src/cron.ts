import cron from 'node-cron';
import { releasePendingTransactions } from './reservations';

cron.schedule('* * * * *', async () => {
  try {
    const released = await releasePendingTransactions();
    for (const tx of released) console.log(`[Cron:Expiry] Released expired tx ${tx.transaction_id}`);
  } catch (error) {
    console.error('[Cron:Expiry] Error:', error);
  }
});

// SSLCommerz reconciliation is disabled alongside its stub IPN endpoint.
// A live integration must validate gateway payments and use transaction locks.

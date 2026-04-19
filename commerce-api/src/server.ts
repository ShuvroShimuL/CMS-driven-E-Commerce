import dns from 'dns';

// Supreme Monkey Patch: Aggressively intercept absolutely all DNS lookups and permanently force IPv4 (family: 4)
// This definitively crushes the Render pg-pool ENETUNREACH bug by bypassing connection-string logic completely.
const originalLookup = dns.lookup;
// @ts-ignore
dns.lookup = function (hostname: any, options: any, callback: any) {
    if (typeof options === 'function') {
        callback = options;
        options = { family: 4 };
    } else if (typeof options === 'object') {
        options.family = 4;
    } else {
        options = { family: 4 };
    }
    // @ts-ignore
    return originalLookup(hostname, options, callback);
};
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { commerceRoutes } from './routes';
import { userRouter } from './userRoutes';
import { shippingRouter } from './shippingRoutes';
import { webhookRouter } from './webhookRoutes';
import { couponRouter } from './couponRoutes';
import { reviewRouter } from './reviewRoutes';
import { wishlistRouter } from './wishlistRoutes';
import { otpRouter } from './otpRoutes';
import { cartLimiter } from './middleware';
import { runMigrations } from './init';
import './cron';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Main Microservice Gateway
app.use('/api/v1', commerceRoutes);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/shipping', cartLimiter, shippingRouter);
app.use('/api/v1/webhooks', webhookRouter);
app.use('/api/v1/coupons', couponRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/wishlist', wishlistRouter);
app.use('/api/v1/otp', otpRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'active', service: 'commerce-api', sprint: 9 });
});

// Auto-migrate on every startup — idempotent (IF NOT EXISTS), safe to re-run
runMigrations().then(() => {
  app.listen(port, () => {
    console.log(`Commerce API active on port ${port}`);
  });
}).catch((err) => {
  console.error('Fatal: DB migration failed on startup:', err);
  process.exit(1);
});

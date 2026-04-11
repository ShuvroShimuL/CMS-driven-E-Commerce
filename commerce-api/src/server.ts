import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { commerceRoutes } from './routes';
import './cron';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Main Microservice Gateway
app.use('/api/v1', commerceRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'active', service: 'commerce-api' });
});

app.listen(port, () => {
  console.log(`Commerce API active on port ${port}`);
});

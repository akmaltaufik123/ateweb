import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const app = express();
const API_URL = process.env.PADOONSTA_API_URL || 'https://padooinsta.com/api/v2';
const API_KEY = process.env.PADOONSTA_API_KEY;
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend in production
const distPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(distPath));

// Helper: proxy POST to PadooInsta API
async function proxyToApi(params) {
  const body = new URLSearchParams({ key: API_KEY, ...params });
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json();
}

// Manual WhatsApp checkout: never submit paid upstream orders from public endpoints.
// These operations require a separate authenticated admin workflow.
const adminGuard = (req, res, next) => {
  const configured = process.env.BOOSTER_ADMIN_TOKEN;
  const provided = req.get('x-admin-token');
  if (!configured || !provided || provided.length !== configured.length) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!timingSafeEqual(Buffer.from(provided), Buffer.from(configured))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
const { timingSafeEqual } = await import('node:crypto');
app.use(['/api/order', '/api/balance', '/api/refill', '/api/cancel'], adminGuard);

// GET /api/services — fetch all services
app.get('/api/services', async (_req, res) => {
  try {
    const data = await proxyToApi({ action: 'services' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

// POST /api/order — place a new order
app.post('/api/order', async (req, res) => {
  try {
    const { service, link, quantity, comments, runs, interval, usernames, hashtag, country } = req.body;
    const params = { action: 'add', service, link, quantity };
    if (comments) params.comments = comments;
    if (runs) params.runs = runs;
    if (interval) params.interval = interval;
    if (usernames) params.usernames = usernames;
    if (hashtag) params.hashtag = hashtag;
    if (country) params.country = country;
    const data = await proxyToApi(params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// POST /api/status — check order status
app.post('/api/status', async (req, res) => {
  try {
    const { order, orders } = req.body;
    const params = { action: 'status' };
    if (order) params.order = order;
    if (orders) params.orders = orders;
    const data = await proxyToApi(params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order status' });
  }
});

// GET /api/balance — check API balance
app.get('/api/balance', async (_req, res) => {
  try {
    const data = await proxyToApi({ action: 'balance' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// POST /api/refill — request refill
app.post('/api/refill', async (req, res) => {
  try {
    const { order, orders } = req.body;
    const params = { action: 'refill' };
    if (order) params.order = order;
    if (orders) params.orders = orders;
    const data = await proxyToApi(params);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to request refill' });
  }
});

// POST /api/cancel — cancel orders
app.post('/api/cancel', async (req, res) => {
  try {
    const { orders } = req.body;
    const data = await proxyToApi({ action: 'cancel', orders });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel orders' });
  }
});

// SPA fallback
app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`ATE SMM Panel server running on port ${PORT}`);
});

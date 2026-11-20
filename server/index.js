import express from 'express';
import dotenv from 'dotenv';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
const port = process.env.PORT || 3000;
const upstreamUrl = process.env.PADOONSTA_API_URL || 'https://padooinsta.com/api/v2';
const upstreamKey = process.env.PADOONSTA_API_KEY;
const adminToken = process.env.BOOSTER_ADMIN_TOKEN;
const dbPath = process.env.BOOSTER_DB_PATH || path.join(root, 'data', 'booster.json');
const fx = Number(process.env.BOOSTER_USD_MYR || 4.47);
const defaultMarkup = Number(process.env.BOOSTER_MARKUP_PERCENT || 30);
if (!adminToken || adminToken.length < 24) console.warn('BOOSTER_ADMIN_TOKEN missing/too short: admin operations disabled');
const validNumber = (n, min, max) => Number.isFinite(Number(n)) && Number(n) >= min && Number(n) <= max;
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const guard = (req, res, next) => {
  if (!adminToken || adminToken.length < 24 || !equal(req.get('x-admin-token'), adminToken)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
const adminLimiter = new Map();
app.use('/api/admin', (req, res, next) => {
  const key = req.ip || 'unknown';
  const now = Date.now(), record = adminLimiter.get(key) || { count: 0, until: now + 60000 };
  if (record.until < now) { record.count = 0; record.until = now + 60000; }
  record.count++; adminLimiter.set(key, record);
  if (record.count > 60) return res.status(429).json({ error: 'Too many requests' });
  next();
}, guard);
const blank = () => ({ orders: [], pricing: {}, events: [] });
let state;
async function load() {
  try { state = JSON.parse(await readFile(dbPath, 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    state = blank();
  }
  state.orders ||= []; state.pricing ||= {}; state.events ||= [];
}
let queue = Promise.resolve();
async function persist() {
  await mkdir(path.dirname(dbPath), { recursive: true });
  const tmp = dbPath + '.tmp';
  await writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(tmp, dbPath);
}
function mutation(fn) {
  const work = queue.then(async () => { const result = await fn(); await persist(); return result; });
  queue = work.catch(() => {});
  return work;
}
function log(action, orderId) {
  state.events.unshift({ at: new Date().toISOString(), action, orderId });
  state.events = state.events.slice(0, 500);
}
async function provider(params) {
  if (!upstreamKey) throw new Error('Provider API not configured');
  const response = await fetch(upstreamUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ key: upstreamKey, ...params }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Provider unavailable');
  const result = await response.json();
  if (result.error) throw new Error(String(result.error).slice(0, 160));
  return result;
}
let cache = { at: 0, services: [] };
async function services() {
  if (Date.now() - cache.at < 120000 && cache.services.length) return cache.services;
  const result = await provider({ action: 'services' });
  if (!Array.isArray(result)) throw new Error('Invalid provider service response');
  cache = { at: Date.now(), services: result };
  return result;
}
function price(svc, quantity) {
  const providerRate = Number(svc.rate);
  const markup = state.pricing[String(svc.service)]?.markup ?? defaultMarkup;
  if (!validNumber(providerRate, 0, 100000) || !validNumber(fx, 0.01, 100) || !validNumber(markup, 0, 10000)) throw new Error('Pricing configuration invalid');
  const cost = providerRate * quantity / 1000 * fx;
  const sale = Math.ceil(cost * (1 + markup / 100) * 100) / 100;
  return { costMYR: Math.round(cost * 100) / 100, saleMYR: sale, markup };
}
function publicService(s) {
  return { service: s.service, name: s.name, type: s.type, category: s.category, min: s.min, max: s.max, refill: s.refill, cancel: s.cancel, rate: String((price(s, 1000).saleMYR / fx).toFixed(6)) };
}
app.get('/api/services', async (_req, res) => {
  try { res.json((await services()).filter(s => state.pricing[String(s.service)]?.enabled !== false).map(publicService)); }
  catch { res.status(502).json({ error: 'Services temporarily unavailable' }); }
});
app.post('/api/checkout', async (req, res) => {
  try {
    const { service, link, quantity, comments } = req.body;
    if (!Number.isSafeInteger(Number(service)) || !Number.isSafeInteger(Number(quantity)) || typeof link !== 'string' || link.length > 2048 || !/^https?:\/\//i.test(link) || (comments !== undefined && (typeof comments !== 'string' || comments.length > 5000))) return res.status(400).json({ error: 'Invalid order details' });
    const svc = (await services()).find(s => Number(s.service) === Number(service));
    if (!svc || state.pricing[String(svc.service)]?.enabled === false) return res.status(404).json({ error: 'Service unavailable' });
    if (Number(quantity) < Number(svc.min) || Number(quantity) > Number(svc.max)) return res.status(400).json({ error: 'Quantity outside provider limits' });
    if (String(svc.type).toLowerCase().includes('custom comment') && !comments?.trim()) return res.status(400).json({ error: 'Comments required' });
    const quote = price(svc, Number(quantity));
    const order = await mutation(() => {
      const record = { id: randomUUID(), createdAt: new Date().toISOString(), service: Number(service), serviceName: String(svc.name), link, quantity: Number(quantity), comments: comments || '', ...quote, status: 'pending_payment', providerOrderId: null, providerStatus: null };
      state.orders.push(record); log('checkout_created', record.id); return record;
    });
    const message = ['Salam, saya ingin membuat tempahan ATE Booster.', 'Rujukan: ' + order.id, 'Servis: ' + order.serviceName, 'Pautan: ' + order.link, 'Kuantiti: ' + order.quantity, 'Harga: RM' + order.saleMYR.toFixed(2), 'Sila berikan arahan pembayaran.'].join('\n');
    res.status(201).json({ id: order.id, amountMYR: order.saleMYR, whatsappUrl: 'https://wa.me/60189451570?text=' + encodeURIComponent(message), status: order.status });
  } catch { res.status(502).json({ error: 'Unable to create checkout' }); }
});
app.get('/api/admin/orders', (_req, res) => res.json(state.orders.slice().reverse()));
app.post('/api/status', (_req, res) => res.status(403).json({ error: 'Order tracking is available through admin support' }));
app.get('/api/admin/summary', async (_req, res) => {
  try {
    const balance = await provider({ action: 'balance' });
    const paid = state.orders.filter(o => ['paid', 'submitting', 'submitted', 'completed'].includes(o.status));
    res.json({ orders: state.orders.length, pending: state.orders.filter(o => o.status === 'pending_payment').length, revenueMYR: paid.reduce((a, o) => a + o.saleMYR, 0), estimatedProfitMYR: paid.reduce((a, o) => a + o.saleMYR - o.costMYR, 0), balance, events: state.events.slice(0, 30) });
  } catch { res.json({ orders: state.orders.length, pending: state.orders.filter(o => o.status === 'pending_payment').length, balance: null, events: state.events.slice(0, 30) }); }
});
app.get('/api/admin/pricing', async (_req, res) => { try { res.json({ pricing: state.pricing, defaultMarkup, fx, services: await services() }); } catch { res.status(502).json({ error: 'Provider services unavailable' }); } });
app.put('/api/admin/pricing/:service', async (req, res) => {
  const id = Number(req.params.service), { markup, enabled } = req.body;
  if (!Number.isSafeInteger(id) || id < 1 || !validNumber(markup, 0, 10000) || typeof enabled !== 'boolean') return res.status(400).json({ error: 'Invalid pricing' });
  try { await mutation(() => { state.pricing[String(id)] = { markup: Number(markup), enabled }; log('pricing_updated', String(id)); }); res.json({ ok: true }); }
  catch { res.status(500).json({ error: 'Save failed' }); }
});
app.post('/api/admin/orders/:id/confirm-payment', async (req, res) => {
  try {
    const order = await mutation(() => {
      const found = state.orders.find(o => o.id === req.params.id);
      if (!found || found.status !== 'pending_payment') return null;
      found.status = 'paid'; found.paidAt = new Date().toISOString(); log('payment_confirmed', found.id); return found;
    });
    if (!order) return res.status(409).json({ error: 'Order not pending payment' });
    res.json({ id: order.id, status: order.status });
  } catch { res.status(500).json({ error: 'Save failed' }); }
});
app.post('/api/admin/orders/:id/submit', async (req, res) => {
  let order;
  try {
    order = await mutation(() => {
      const found = state.orders.find(o => o.id === req.params.id);
      if (!found || found.status !== 'paid') return null;
      found.status = 'submitting'; log('provider_submission_started', found.id); return { ...found };
    });
    if (!order) return res.status(409).json({ error: 'Order must be paid and not previously submitted' });
    const params = { action: 'add', service: String(order.service), link: order.link, quantity: String(order.quantity) };
    if (order.comments) params.comments = order.comments;
    const result = await provider(params);
    if (!result.order) throw new Error('Provider returned no order ID');
    await mutation(() => { const found = state.orders.find(o => o.id === order.id); found.providerOrderId = result.order; found.status = 'submitted'; log('provider_order_submitted', found.id); });
    res.json({ id: order.id, providerOrderId: result.order, status: 'submitted' });
  } catch {
    // Do not automatically retry: provider may have accepted the request before a timeout.
    res.status(502).json({ error: 'Provider result uncertain; inspect provider before any retry. Order remains submitting.' });
  }
});
app.post('/api/admin/orders/:id/status', async (req, res) => {
  const order = state.orders.find(o => o.id === req.params.id);
  if (!order?.providerOrderId) return res.status(404).json({ error: 'No provider order ID' });
  try {
    const status = await provider({ action: 'status', order: String(order.providerOrderId) });
    await mutation(() => { order.providerStatus = status; log('status_checked', order.id); });
    res.json(status);
  } catch { res.status(502).json({ error: 'Provider status unavailable' }); }
});
app.post('/api/admin/orders/:id/refill', async (req, res) => {
  const order = state.orders.find(o => o.id === req.params.id);
  if (!order?.providerOrderId) return res.status(404).json({ error: 'No provider order ID' });
  try { res.json(await provider({ action: 'refill', order: String(order.providerOrderId) })); }
  catch { res.status(502).json({ error: 'Refill unavailable' }); }
});
app.post('/api/admin/orders/:id/cancel', async (req, res) => {
  const order = state.orders.find(o => o.id === req.params.id);
  if (!order?.providerOrderId) return res.status(404).json({ error: 'No provider order ID' });
  try { res.json(await provider({ action: 'cancel', orders: String(order.providerOrderId) })); }
  catch { res.status(502).json({ error: 'Cancel unavailable' }); }
});
// Legacy provider mutation endpoints intentionally removed. Only admin order workflows can spend credit.
app.use(express.static(path.join(root, 'dist')));
app.get('/admin/booster', (_req, res) => res.sendFile(path.join(root, 'server', 'admin.html')));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
await load();
app.listen(port, () => console.log('ATE Booster listening on ' + port));

import express from 'express';
import { createHash, createHmac, timingSafeEqual, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { openStore } from './store.js';
import { createProvider } from './provider.js';
import { HttpError, requireThat, numeric, quote, supported, validateCheckout } from './domain.js';

const hash = s => createHash('sha256').update(s).digest('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const now = () => new Date().toISOString();
const idPattern = /^[a-zA-Z0-9_-]{16,128}$/;
const providerId = v => (typeof v === 'string' || (typeof v === 'number' && Number.isSafeInteger(v))) && /^(?:[1-9]\d{0,19})$/.test(String(v));
const money = n => Math.round(n * 100) / 100;

export function createApp({ root, env = process.env, fetchImpl = fetch }) {
  const app = express();
  const production = env.NODE_ENV === 'production';
  const origin = env.BOOSTER_PUBLIC_ORIGIN || 'http://localhost:3000';
  requireThat(new URL(origin).origin === origin && (!production || origin.startsWith('https://')), 500, 'Configure a canonical HTTPS public origin');
  const token = env.BOOSTER_ADMIN_TOKEN || '';
  requireThat(!production || token.length >= 32, 500, 'Configure a strong administrator credential');
  requireThat(!production || (env.BOOSTER_DB_PATH && path.isAbsolute(env.BOOSTER_DB_PATH)), 500, 'Production requires an absolute persistent database path');
  const store = openStore(env.BOOSTER_DB_PATH || path.join(root, 'data', 'booster.sqlite'));
  const { db, tx, order, save, event } = store;
  const defaults = { fx: Number(env.BOOSTER_USD_MYR || 4.47), defaultMarkup: Number(env.BOOSTER_MARKUP_PERCENT || 30), providerCurrency: env.BOOSTER_PROVIDER_CURRENCY || 'USD', whatsapp: '60189451570' };
  function validateSettings(s) { requireThat(numeric(s.fx, 0.01, 100) && numeric(s.defaultMarkup, 0, 10000) && ['USD', 'MYR'].includes(s.providerCurrency) && /^\d{8,15}$/.test(s.whatsapp), 400, 'Invalid pricing settings'); }
  validateSettings(defaults);
  db.prepare('INSERT OR IGNORE INTO settings VALUES(1,?)').run(JSON.stringify(defaults));
  const settings = () => JSON.parse(db.prepare('SELECT data FROM settings WHERE id=1').get().data);
  const pricing = id => store.pricing()[String(id)] || {};
  const provider = createProvider({ url: env.PADOONSTA_API_URL || 'https://padooinsta.com/api/v2', key: env.PADOONSTA_API_KEY, timeout: Number(env.BOOSTER_PROVIDER_TIMEOUT_MS || 15000), fetchImpl });
  const sessionHash = value => createHmac('sha256', token).update(value).digest('hex');
  const cookieName = production ? '__Host-booster' : 'booster';
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/', maxAge: 8 * 3600000 };
  if (env.BOOSTER_TRUST_PROXY) app.set('trust proxy', env.BOOSTER_TRUST_PROXY.split(',').map(s => s.trim()));
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
    if (production) res.set('Strict-Transport-Security', 'max-age=31536000');
    if (req.path.startsWith('/api/') || req.path.startsWith('/admin/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    if (production && !req.secure && req.path !== '/health') return res.status(400).json({ error: 'HTTPS required' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('origin') && req.get('origin') !== origin) return res.status(403).json({ error: 'Origin rejected' });
      if (!req.is('application/json')) return res.status(415).json({ error: 'JSON required' });
    }
    next();
  });
  const limits = new Map();
  function limiter(scope, count, window = 60000) {
    return (req, res, next) => {
      const time = Date.now();
      if (limits.size > 10000) for (const [key, value] of limits) if (value.until <= time) limits.delete(key);
      const key = scope + ':' + req.ip;
      const item = limits.get(key);
      if (!item && limits.size >= 20000) return res.status(429).json({ error: 'Try again later' });
      const entry = item && item.until > time ? item : { count: 0, until: time + window };
      limits.set(key, entry); entry.count++;
      if (entry.count > count) { res.set('Retry-After', String(Math.ceil((entry.until - time) / 1000))); return res.status(429).json({ error: 'Too many requests' }); }
      next();
    };
  }
  app.use('/api', limiter('api', 240));
  app.use(express.json({ limit: '16kb' }));
  function session(req) {
    const value = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
    return db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').get(sessionHash(value), Date.now());
  }
  app.post('/api/session', limiter('login', 5, 15 * 60000), (req, res) => {
    requireThat(token.length >= 32 && equal(req.body?.token, token), 403, 'Invalid administrator credential');
    const value = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    tx(() => {
      db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
      const prior = session(req); if (prior) db.prepare('DELETE FROM sessions WHERE hash=?').run(prior.hash);
      db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(sessionHash(value), csrf, 'administrator', Date.now() + 8 * 3600000);
      event('administrator', 'session_created');
    });
    res.cookie(cookieName, value, cookieOptions).json({ csrf, actor: 'administrator' });
  });
  app.get('/api/session', (req, res) => { const s = session(req); requireThat(s, 401, 'Sign in required'); res.json({ csrf: s.csrf, actor: s.actor }); });
  app.use('/api/admin', limiter('admin', 120), (req, res, next) => {
    const s = session(req); requireThat(s, 401, 'Sign in required');
    if (!['GET', 'HEAD'].includes(req.method)) requireThat(equal(req.get('x-csrf-token'), s.csrf), 403, 'CSRF token required');
    req.admin = s; next();
  });
  app.post('/api/admin/logout', (req, res) => { db.prepare('DELETE FROM sessions WHERE hash=?').run(req.admin.hash); res.clearCookie(cookieName, { ...cookieOptions, maxAge: undefined }).json({ ok: true }); });
  app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ ok: true }); });
  const getService = async (id, fresh = false) => {
    const s = (await provider.services(fresh)).find(s => s.service === Number(id));
    requireThat(s && pricing(id).enabled !== false && supported(s), 409, 'Service unavailable or unsupported'); return s;
  };
  app.get('/api/services', async (_req, res) => {
    const config = settings(), rules = store.pricing();
    res.json((await provider.services()).filter(s => supported(s) && rules[s.service]?.enabled !== false).flatMap(s => {
      try { return [{ ...s, rate: String(quote(s, 1000, config, rules[s.service]).saleMYR), currency: 'MYR' }]; } catch { return []; }
    }));
  });
  function checkoutResult(o) {
    const message = ['Salam, saya ingin membuat tempahan ATE Booster.', 'Rujukan: ' + o.id, 'Servis: ' + o.serviceName, 'Pautan: ' + o.link, 'Kuantiti: ' + o.quantity, 'Harga: RM' + o.saleMYR.toFixed(2), 'Sila berikan arahan pembayaran.'].join('\n');
    return { id: o.id, amountMYR: o.saleMYR, status: o.status, whatsappUrl: 'https://wa.me/' + o.whatsapp + '?text=' + encodeURIComponent(message) };
  }
  app.post('/api/checkout', limiter('checkout', 15), async (req, res) => {
    const key = req.get('idempotency-key');
    requireThat(typeof key === 'string' && idPattern.test(key), 400, 'Valid Idempotency-Key required');
    const body = req.body;
    requireThat(body && numeric(body.service, 1, Number.MAX_SAFE_INTEGER) && Number.isSafeInteger(Number(body.service)), 400, 'Invalid service');
    const fingerprint = hash(JSON.stringify([body.service, body.link, body.quantity, body.comments || '']));
    const existing = db.prepare('SELECT * FROM orders WHERE idempotency=?').get(key);
    if (existing) { requireThat(existing.fingerprint === fingerprint, 409, 'Idempotency key already used for different details'); return res.json(checkoutResult(JSON.parse(existing.data))); }
    const svc = await getService(body.service, true);
    const details = validateCheckout(body, svc);
    const result = tx(() => {
      const duplicate = db.prepare('SELECT * FROM orders WHERE idempotency=?').get(key);
      if (duplicate) { requireThat(duplicate.fingerprint === fingerprint, 409, 'Idempotency conflict'); return JSON.parse(duplicate.data); }
      requireThat(pricing(svc.service).enabled !== false, 409, 'Service disabled');
      const config = settings();
      const o = { id: randomUUID(), createdAt: now(), ...details, serviceName: svc.name, serviceType: svc.type, ...quote(svc, details.quantity, config, pricing(svc.service)), whatsapp: config.whatsapp, refill: svc.refill, cancel: svc.cancel, status: 'pending_payment', providerOrderId: null, providerStatus: null };
      db.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').run(o.id, key, fingerprint, null, JSON.stringify(o));
      event('customer', 'checkout_created', o.id); return o;
    });
    res.status(201).json(checkoutResult(result));
  });
  app.get('/api/admin/orders', (req, res) => {
    const search = String(req.query.search || '').toLowerCase(), status = String(req.query.status || '');
    res.json(store.orders().filter(o => (!status || (status === 'disputed' ? o.disputed : o.status === status)) && [o.id, o.serviceName, String(o.service), o.link, String(o.providerOrderId || '')].join(' ').toLowerCase().includes(search)));
  });
  app.get('/api/admin/orders/:id', (req, res) => {
    const o = order(req.params.id); requireThat(o, 404, 'Order not found');
    res.json({ ...o, payment: db.prepare('SELECT * FROM payments WHERE order_id=?').get(o.id) || null, events: store.events(o.id), operations: db.prepare('SELECT * FROM operations WHERE order_id=?').all(o.id).map(r => ({ ...r, data: JSON.parse(r.data) })) });
  });
  app.get('/api/admin/audit', (_req, res) => res.json(store.events()));
  app.post('/api/admin/orders/:id/review', (req, res) => {
    const { disputed, note } = req.body || {};
    requireThat(typeof disputed === 'boolean' && typeof note === 'string' && note.trim().length >= 10 && note.length <= 500, 400, 'A review note of 10–500 characters is required');
    tx(() => { const o = order(req.params.id); requireThat(o, 404, 'Order not found'); o.disputed = disputed; save(o); event(req.admin.actor, disputed ? 'order_disputed' : 'order_dispute_resolved', o.id, { note }); });
    res.json(order(req.params.id));
  });
  app.get('/api/admin/transactions', (_req, res) => res.json(db.prepare('SELECT * FROM payments ORDER BY at DESC').all()));
  async function balance() {
    const b = await provider.call({ action: 'balance' });
    requireThat(numeric(b.balance, 0, 1e12) && ['USD', 'MYR'].includes(b.currency), 502, 'Invalid provider balance');
    return { balance: String(b.balance), currency: b.currency };
  }
  app.get('/api/admin/summary', async (_req, res) => {
    const orders = store.orders(), paid = orders.filter(o => o.paidAt), counts = {};
    for (const o of orders) counts[o.status] = (counts[o.status] || 0) + 1;
    let providerBalance = null; try { providerBalance = await balance(); } catch { /* financial summaries remain available offline */ }
    res.json({ orders: orders.length, counts, disputedOrders: orders.filter(o => o.disputed).length, pending: counts.pending_payment || 0, revenueMYR: money(paid.reduce((a, o) => a + o.saleMYR, 0)), providerCostsMYR: money(paid.reduce((a, o) => a + (o.actualCostMYR ?? o.costMYR), 0)), estimatedProfitMYR: money(paid.reduce((a, o) => a + o.saleMYR - o.costMYR, 0)), realizedProfitMYR: money(paid.filter(o => o.status === 'completed' && !o.disputed && o.actualCostMYR != null).reduce((a, o) => a + o.saleMYR - o.actualCostMYR, 0)), balance: providerBalance, currencyMismatch: Boolean(providerBalance && providerBalance.currency !== settings().providerCurrency), events: store.events().slice(0, 30) });
  });
  app.get('/api/admin/settings', (_req, res) => res.json({ ...settings(), providerConfigured: Boolean(env.PADOONSTA_API_KEY), sessionHours: 8, account: 'Single administrator' }));
  app.put('/api/admin/settings', (req, res) => {
    const { fx, defaultMarkup, providerCurrency, whatsapp } = req.body || {};
    const value = { fx, defaultMarkup, providerCurrency, whatsapp }; validateSettings(value);
    tx(() => { const before = settings(); db.prepare('UPDATE settings SET data=? WHERE id=1').run(JSON.stringify(value)); event(req.admin.actor, 'settings_updated', null, { before, after: value }); });
    res.json(value);
  });
  app.get('/api/admin/pricing', async (_req, res) => {
    const config = settings(), rules = store.pricing();
    res.json({ ...config, pricing: rules, services: (await provider.services()).map(s => {
      let estimate = null; try { estimate = quote(s, 1000, config, rules[s.service]); } catch { /* unpriced service */ }
      return { ...s, supported: supported(s), estimate };
    }) });
  });
  app.put('/api/admin/pricing/:service', async (req, res) => {
    const svc = (await provider.services()).find(s => String(s.service) === req.params.service);
    requireThat(svc, 404, 'Unknown service');
    const { markup, enabled, sellingRateMYR } = req.body || {};
    requireThat(typeof enabled === 'boolean' && numeric(markup, 0, 10000) && (sellingRateMYR == null || numeric(sellingRateMYR, 0.01, 1000000)), 400, 'Invalid pricing');
    const rule = { markup: Number(markup), enabled, sellingRateMYR: sellingRateMYR == null ? null : Number(sellingRateMYR) };
    tx(() => { const before = pricing(svc.service); db.prepare('INSERT INTO pricing VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(String(svc.service), JSON.stringify(rule)); event(req.admin.actor, 'pricing_updated', null, { service: svc.service, before, after: rule }); });
    res.json({ ok: true });
  });
  app.post('/api/admin/orders/:id/confirm-payment', (req, res) => {
    const { reference, amountMYR, verified } = req.body || {};
    requireThat(verified === true && typeof reference === 'string' && reference.trim().length >= 3 && /[a-z0-9]/i.test(reference) && /^[\w .:/-]{3,100}$/.test(reference), 400, 'Independent payment verification and bank reference required');
    const o = tx(() => {
      const o = order(req.params.id); requireThat(o && (o.status === 'pending_payment' || o.paymentReviewRequired), 409, 'Order is not pending payment');
      requireThat(numeric(amountMYR, 0.01, 1000000) && Math.abs(Number(amountMYR) * 100 - Math.round(Number(amountMYR) * 100)) < 1e-6 && Math.round(Number(amountMYR) * 100) === o.saleCents, 400, 'Payment must equal the saved quote');
      requireThat(!db.prepare('SELECT 1 FROM payments WHERE reference=?').get(reference.trim().toUpperCase()), 409, 'Payment reference already recorded');
      db.prepare('INSERT INTO payments VALUES(?,?,?,?,?)').run(o.id, reference.trim().toUpperCase(), o.saleCents, req.admin.actor, now());
      if (o.status === 'pending_payment') o.status = 'paid';
      delete o.paymentReviewRequired;
      o.paidAt = now(); save(o); event(req.admin.actor, 'payment_confirmed', o.id, { amountCents: o.saleCents }); return o;
    });
    res.json(o);
  });
  app.post('/api/admin/orders/:id/submit', async (req, res) => {
    requireThat(req.body?.authorized === true, 400, 'Explicit provider spend authorization required');
    const initial = order(req.params.id); requireThat(initial?.status === 'paid', 409, 'Order must be paid and not previously submitted');
    const svc = await getService(initial.service, true);
    requireThat(svc.type === initial.serviceType, 409, 'Provider service type changed; reconcile manually');
    validateCheckout({ service: initial.service, link: initial.link, quantity: initial.quantity, comments: initial.comments }, svc);
    const b = await balance(); requireThat(b.currency === initial.providerCurrency, 409, 'Provider currency does not match saved quote');
    const o = tx(() => {
      const o = order(req.params.id); requireThat(o?.status === 'paid' && !o.disputed && db.prepare('SELECT 1 FROM payments WHERE order_id=?').get(o.id), 409, 'Payment confirmation required; order disputed or submission already started');
      requireThat(pricing(o.service).enabled !== false, 409, 'Service disabled');
      const currentCost = Number(svc.rate) * o.quantity / 1000 * o.fx;
      requireThat(currentCost <= o.costMYR + 0.01 && Number(b.balance) >= Number(svc.rate) * o.quantity / 1000, 409, 'Provider cost increased or balance insufficient; reconcile manually');
      o.status = 'submitting'; o.submissionAt = now(); save(o); event(req.admin.actor, 'provider_submission_started', o.id); return o;
    });
    try {
      const params = { action: 'add', service: String(o.service), link: o.link };
      if (o.serviceType.toLowerCase() === 'custom comments') params.comments = o.comments;
      else params.quantity = String(o.quantity);
      const result = await provider.call(params);
      requireThat(providerId(result.order), 502, 'Missing provider reference');
      tx(() => { const current = order(o.id); current.providerOrderId = String(result.order); current.status = 'submitted'; save(current); event(req.admin.actor, 'provider_order_submitted', o.id, { providerOrderId: current.providerOrderId }); });
      res.json(order(o.id));
    } catch {
      tx(() => { const current = order(o.id); if (current.status === 'submitting') { current.status = 'reconciliation_required'; save(current); } event(req.admin.actor, 'provider_submission_uncertain', o.id); });
      throw new HttpError(502, 'Provider result uncertain. Reconcile in provider account; do not submit again.');
    }
  });
  // Attach an independently verified upstream ID; never automatically reset a possibly charged order.
  app.post('/api/admin/orders/:id/reconcile', async (req, res) => {
    const { providerOrderId, note } = req.body || {};
    requireThat(providerId(providerOrderId) && typeof note === 'string' && note.trim().length >= 10 && note.length <= 500, 400, 'Verified provider ID and reconciliation note required');
    await provider.call({ action: 'status', order: String(providerOrderId) });
    tx(() => { const o = order(req.params.id); requireThat(o && ['submitting', 'reconciliation_required'].includes(o.status), 409, 'Order does not require reconciliation'); requireThat(!db.prepare('SELECT 1 FROM orders WHERE provider_id=?').get(String(providerOrderId)), 409, 'Provider order already attached'); o.providerOrderId = String(providerOrderId); o.status = 'submitted'; save(o); event(req.admin.actor, 'provider_order_reconciled', o.id, { note, providerOrderId: o.providerOrderId }); });
    res.json(order(req.params.id));
  });
  app.post('/api/admin/orders/:id/status', async (req, res) => {
    const o = order(req.params.id); requireThat(o?.providerOrderId, 404, 'No provider reference');
    const result = await provider.call({ action: 'status', order: o.providerOrderId });
    const statusMap = { pending: 'submitted', processing: 'submitted', 'in progress': 'submitted', completed: 'completed', partial: 'partial', canceled: 'cancelled', cancelled: 'cancelled', failed: 'failed' };
    const status = statusMap[String(result.status).toLowerCase()]; requireThat(status, 502, 'Unrecognized provider status');
    const safe = { status: String(result.status), remains: String(result.remains ?? '').slice(0, 30), start_count: String(result.start_count ?? '').slice(0, 30) };
    tx(() => {
      const current = order(o.id);
      requireThat(current.syncedAt === o.syncedAt, 409, 'Another status sync completed; refresh the order');
      requireThat(!['completed', 'cancelled', 'failed'].includes(current.status) || current.status === status, 409, 'Provider final status changed; independent reconciliation required');
      current.providerStatus = safe; current.status = status; current.syncedAt = now();
      if (numeric(result.charge, 0, 1e9) && result.currency === current.providerCurrency) current.actualCostMYR = money(Number(result.charge) * current.fx);
      save(current); event(req.admin.actor, 'provider_status_synced', o.id, { status });
    });
    res.json(order(o.id));
  });
  for (const kind of ['refill', 'cancel']) app.post('/api/admin/orders/:id/' + kind, async (req, res) => {
    requireThat(req.body?.authorized === true, 400, 'Explicit operation authorization required');
    const initial = order(req.params.id); requireThat(initial?.providerOrderId, 404, 'No provider reference');
    const svc = (await provider.services(true)).find(s => s.service === initial.service);
    requireThat(svc?.[kind] && initial[kind], 409, 'Operation unsupported by service');
    requireThat(kind === 'refill' ? ['completed', 'partial'].includes(initial.status) : ['submitted', 'partial'].includes(initial.status), 409, 'Operation unavailable for order status');
    const operation = randomUUID();
    tx(() => {
      requireThat(!db.prepare('SELECT 1 FROM operations WHERE order_id=? AND kind=?').get(initial.id, kind), 409, 'Operation already requested; inspect its history');
      db.prepare('INSERT INTO operations VALUES(?,?,?,?,?)').run(operation, initial.id, kind, 'requesting', '{}'); event(req.admin.actor, kind + '_requested', initial.id);
    });
    try {
      const r = await provider.call(kind === 'refill' ? { action: kind, order: initial.providerOrderId } : { action: kind, orders: initial.providerOrderId });
      let result;
      if (kind === 'refill') { requireThat(providerId(r.refill), 502, 'Invalid refill response'); result = { refill: String(r.refill) }; }
      else { const item = Array.isArray(r) && r.find(v => String(v.order) === initial.providerOrderId); requireThat(item?.cancel === 1 || item?.cancel === '1', 502, 'Cancellation not confirmed'); result = { accepted: true }; }
      tx(() => { db.prepare('UPDATE operations SET state=?,data=? WHERE id=?').run('accepted', JSON.stringify(result), operation); event(req.admin.actor, kind + '_accepted', initial.id, result); });
      res.json(result);
    } catch {
      tx(() => { db.prepare('UPDATE operations SET state=? WHERE id=?').run('reconciliation_required', operation); event(req.admin.actor, kind + '_uncertain', initial.id); });
      throw new HttpError(502, 'Operation result uncertain. Reconcile in provider account; do not retry.');
    }
  });
  app.post('/api/admin/orders/:id/refill-status', async (req, res) => {
    const row = db.prepare("SELECT * FROM operations WHERE order_id=? AND kind='refill' AND state='accepted'").get(req.params.id);
    const refill = row && JSON.parse(row.data).refill; requireThat(refill, 404, 'No accepted refill reference');
    const result = await provider.call({ action: 'refill_status', refill });
    requireThat(['Completed', 'Rejected', 'Pending', 'In progress', 'Processing'].includes(result.status), 502, 'Unknown refill status');
    tx(() => { db.prepare('UPDATE operations SET data=? WHERE id=?').run(JSON.stringify({ refill, status: result.status }), row.id); event(req.admin.actor, 'refill_status_synced', req.params.id, { status: result.status }); });
    res.json({ status: result.status });
  });
  app.get('/api/admin/export.csv', (req, res) => {
    const escape = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
    const rows = [['Reference', 'Created', 'Service', 'Quantity', 'Status', 'Payment', 'Sale MYR', 'Estimated cost MYR', 'Actual cost MYR', 'Estimated profit MYR', 'Provider reference'], ...store.orders().map(o => [o.id, o.createdAt, o.serviceName, o.quantity, o.status, o.paidAt ? 'paid' : 'unpaid', o.saleMYR, o.costMYR, o.actualCostMYR, money(o.saleMYR - o.costMYR), o.providerOrderId])];
    event(req.admin.actor, 'financial_export');
    res.type('text/csv').attachment('booster-transactions.csv').send('\uFEFF' + rows.map(r => r.map(escape).join(',')).join('\r\n'));
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.get('/admin/booster', (_req, res) => res.sendFile(path.join(root, 'server', 'admin.html')));
  app.get('/admin/booster.js', (_req, res) => res.sendFile(path.join(root, 'server', 'admin.js')));
  app.get('/admin/booster.css', (_req, res) => res.sendFile(path.join(root, 'server', 'admin.css')));
  app.use('/booster', express.static(path.join(root, 'dist'), { index: false }));
  app.use(express.static(path.join(root, 'dist'), { index: false }));
  app.get(['/', '/booster', '/booster/'], (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, _req, res, _next) => {
    const status = error instanceof HttpError ? error.status : error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).json({ error: error instanceof HttpError ? error.message : status === 400 ? 'Invalid JSON' : status === 413 ? 'Request too large' : 'Request could not be completed' });
  });
  return { app, store };
}

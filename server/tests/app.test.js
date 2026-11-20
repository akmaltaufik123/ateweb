import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../app.js';
import { quote } from '../domain.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const credential = 'fixture-credential-with-at-least-32-characters';
const service = { service: 1, name: 'Instagram likes', type: 'Default', category: 'Instagram', rate: '2', min: '10', max: '10000', refill: true, cancel: true };
function mockProvider() {
  const calls = [], control = { services: [service], status: 'Completed', charge: '2', fail: null, delay: 0, malformed: false, add: 123 };
  async function fetchImpl(_url, options) {
    const params = Object.fromEntries(options.body); calls.push(params);
    assert.equal(params.key, 'fixture-provider-key');
    if (control.delay && (!control.delayAction || control.delayAction === params.action)) await new Promise((resolve, reject) => { const timer = setTimeout(resolve, control.delay); options.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Timeout')); }, { once: true }); });
    if (control.fail === params.action) throw new Error('fixture-provider-key must never leak');
    if (control.malformed) return new Response('not-json');
    const results = { services: control.services, balance: { balance: '100', currency: 'USD' }, add: { order: control.add }, status: { status: control.status, charge: control.charge, currency: 'USD', remains: '0', start_count: '100' }, refill: { refill: '7' }, cancel: [{ order: 123, cancel: 1 }], refill_status: { status: 'Completed' } };
    return Response.json(results[params.action]);
  }
  return { calls, control, fetchImpl };
}
async function fixture(t, options = {}) {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'ate-booster-test-'));
  const mock = mockProvider();
  const env = { BOOSTER_ADMIN_TOKEN: credential, PADOONSTA_API_KEY: 'fixture-provider-key', BOOSTER_DB_PATH: path.join(temp, 'test.sqlite'), BOOSTER_PROVIDER_TIMEOUT_MS: '30', ...options };
  let instance, server, base, cookie = '', csrf = '';
  async function start() {
    instance = createApp({ root, env, fetchImpl: mock.fetchImpl });
    server = instance.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  async function stop() { await new Promise(resolve => server.close(resolve)); instance.store.close(); }
  await start();
  t.after(async () => { await stop(); rmSync(temp, { recursive: true, force: true }); });
  async function request(url, method = 'GET', body, headers = {}, auth = true) {
    const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { cookie, 'x-csrf-token': csrf } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    assert.ok(!text.includes('fixture-provider-key')); assert.ok(!text.includes(credential));
    return { status: response.status, data, headers: response.headers };
  }
  async function login() { const r = await request('/api/session', 'POST', { token: credential }); assert.equal(r.status, 200); cookie = r.headers.get('set-cookie').split(';')[0]; csrf = r.data.csrf; }
  const details = { service: 1, link: 'https://instagram.com/example', quantity: 1000 };
  const checkout = (key = crypto.randomUUID(), body = details) => request('/api/checkout', 'POST', body, { 'Idempotency-Key': key });
  const confirm = async o => { const r = await request('/api/admin/orders/' + o.id + '/confirm-payment', 'POST', { reference: 'BANK-' + o.id, amountMYR: o.amountMYR, verified: true }); assert.equal(r.status, 200); return r; };
  const submit = o => request('/api/admin/orders/' + o.id + '/submit', 'POST', { authorized: true });
  return { request, checkout, confirm, submit, login, mock, details, restart: async () => { await stop(); await start(); }, store: () => instance.store, base: () => base };
}

test('pricing: USD, MYR, override, rounding and immutable quote', () => {
  const settings = { providerCurrency: 'USD', fx: 4.47, defaultMarkup: 30 };
  assert.equal(quote(service, 1000, settings).saleMYR, 11.63);
  assert.equal(quote(service, 1000, { ...settings, providerCurrency: 'MYR' }).saleMYR, 2.6);
  assert.equal(quote(service, 13, settings, { sellingRateMYR: 5 }).saleMYR, 0.07);
  assert.throws(() => quote({ ...service, rate: '0' }, 1000, settings));
});
test('catalogue retrieval normalizes provider strings, exposes MYR selling rate without costs', async t => {
  const f = await fixture(t); const r = await f.request('/api/services');
  assert.equal(r.status, 200); assert.equal(r.data[0].rate, '11.63'); assert.equal(r.data[0].min, 10); assert.equal(r.data[0].currency, 'MYR');
  await f.request('/api/services'); assert.equal(f.mock.calls.filter(c => c.action === 'services').length, 1);
});
test('unauthorized admin and legacy provider operations are inaccessible', async t => {
  const f = await fixture(t);
  for (const route of ['orders', 'summary', 'settings', 'pricing', 'transactions', 'audit', 'export.csv']) assert.equal((await f.request('/api/admin/' + route)).status, 401);
  for (const route of ['order', 'balance', 'refill', 'cancel', 'status']) assert.equal((await f.request('/api/' + route, 'POST', {})).status, 404);
  assert.equal((await f.request('/api/session', 'POST', { token: 'é'.repeat(credential.length) })).status, 403);
  assert.equal(f.mock.calls.length, 0);
});
test('session cookie, CSRF, origin checking, expiry and logout', async t => {
  const f = await fixture(t); await f.login();
  assert.equal((await f.request('/api/admin/settings')).status, 200);
  assert.equal((await f.request('/api/admin/settings', 'PUT', {}, { 'x-csrf-token': '' })).status, 403);
  assert.equal((await f.request('/api/admin/settings', 'PUT', {}, { origin: 'https://evil.test' })).status, 403);
  f.store().db.prepare('UPDATE sessions SET expires=0').run();
  assert.equal((await f.request('/api/admin/settings')).status, 401);
  await f.login(); assert.equal((await f.request('/api/admin/logout', 'POST', {})).status, 200);
  assert.equal((await f.request('/api/admin/settings')).status, 401);
});
test('checkout validates URLs, quantities, service IDs, unsupported parameters and types', async t => {
  const f = await fixture(t);
  for (const patch of [{ quantity: 1 }, { quantity: 10001 }, { quantity: 10.5 }, { link: 'javascript:alert(1)' }, { link: 'http://' }, { link: 'https://a:b@example.com' }, { link: 'http://127.0.0.1' }, { service: 0 }, { runs: 10 }, { comments: 'unexpected' }]) {
    const r = await f.checkout(crypto.randomUUID(), { ...f.details, ...patch }); assert.equal(r.status, 400, JSON.stringify(patch));
  }
  assert.equal((await f.checkout(crypto.randomUUID(), { ...f.details, service: 999 })).status, 409);
  f.mock.control.services = [{ ...service, type: 'Subscriptions' }];
  assert.equal((await f.checkout()).status, 409);
  assert.equal(f.store().orders().length, 0);
});
test('disabled services absent from public catalogue and blocked at checkout', async t => {
  const f = await fixture(t); await f.login();
  assert.equal((await f.request('/api/admin/pricing/1', 'PUT', { markup: 30, enabled: false })).status, 200);
  assert.deepEqual((await f.request('/api/services')).data, []);
  assert.equal((await f.checkout()).status, 409);
  assert.equal((await f.request('/api/admin/pricing')).data.services.length, 1);
});
test('idempotent concurrent checkout survives restart and rejects changed payload', async t => {
  const f = await fixture(t), key = crypto.randomUUID();
  const [a, b] = await Promise.all([f.checkout(key), f.checkout(key)]);
  assert.equal(a.data.id, b.data.id); assert.equal(f.store().orders().length, 1);
  await f.restart(); const c = await f.checkout(key); assert.equal(c.data.id, a.data.id);
  assert.equal((await f.checkout(key, { ...f.details, quantity: 500 })).status, 409);
  assert.match(c.data.whatsappUrl, /^https:\/\/wa.me\/60189451570\?text=/);
  assert.equal(f.mock.calls.filter(c => c.action === 'add').length, 0);
});
test('payment requires bank reference, exact quote and independent verification; freezes quote', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data;
  assert.equal((await f.submit(o)).status, 409);
  for (const body of [{}, { reference: 'BANK-123', amountMYR: o.amountMYR, verified: false }, { reference: 'BANK-123', amountMYR: 1, verified: true }]) assert.equal((await f.request('/api/admin/orders/' + o.id + '/confirm-payment', 'POST', body)).status, 400);
  await f.request('/api/admin/settings', 'PUT', { fx: 5, defaultMarkup: 99, providerCurrency: 'USD', whatsapp: '60189451570' });
  await f.confirm(o);
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/confirm-payment', 'POST', { reference: 'BANK-SECOND', amountMYR: o.amountMYR, verified: true })).status, 409);
  assert.equal((await f.request('/api/admin/orders/' + o.id)).data.saleMYR, o.amountMYR);
  const details = (await f.request('/api/admin/orders/' + o.id)).data;
  assert.equal(details.payment.amount_cents, 1163); assert.equal(details.payment.actor, 'administrator');
});
test('payment reference cannot authorize two orders', async t => {
  const f = await fixture(t); await f.login(); const a = (await f.checkout()).data, b = (await f.checkout()).data;
  const body = { reference: 'BANK-SAME', amountMYR: a.amountMYR, verified: true };
  assert.equal((await f.request('/api/admin/orders/' + a.id + '/confirm-payment', 'POST', body)).status, 200);
  assert.equal((await f.request('/api/admin/orders/' + b.id + '/confirm-payment', 'POST', body)).status, 409);
});
test('paid-only submission atomically prevents duplicate provider charges across requests and restart', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o);
  const responses = await Promise.all([f.submit(o), f.submit(o)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(f.mock.calls.filter(c => c.action === 'add').length, 1);
  await f.restart(); assert.equal((await f.submit(o)).status, 409);
  assert.equal((await f.request('/api/admin/orders/' + o.id)).data.providerOrderId, '123');
});
test('provider failures on add are not retried and require reconciliation', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o); f.mock.control.fail = 'add';
  assert.equal((await f.submit(o)).status, 502); assert.equal((await f.submit(o)).status, 409);
  assert.equal(f.mock.calls.filter(c => c.action === 'add').length, 1);
  assert.equal((await f.request('/api/admin/orders/' + o.id)).data.status, 'reconciliation_required');
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/reconcile', 'POST', { providerOrderId: '123', note: 'Matched target, service, time and quantity in provider account.' })).status, 200);
});
test('timeouts and malformed provider catalogue fail safely with controlled read retries', async t => {
  const f = await fixture(t); f.mock.control.delay = 100;
  assert.equal((await f.request('/api/services')).status, 502); assert.equal(f.mock.calls.length, 2);
  f.mock.control.delay = 0; f.mock.control.malformed = true;
  assert.equal((await f.request('/api/services')).status, 502);
});
test('status synchronization, actual cost and financial summary remain available during provider outage', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o); await f.submit(o);
  const r = await f.request('/api/admin/orders/' + o.id + '/status', 'POST', {});
  assert.equal(r.status, 200); assert.equal(r.data.status, 'completed'); assert.equal(r.data.actualCostMYR, 8.94);
  const summary = (await f.request('/api/admin/summary')).data;
  assert.equal(summary.realizedProfitMYR, 2.69); assert.equal(summary.counts.completed, 1);
  f.mock.control.fail = 'balance'; const offline = (await f.request('/api/admin/summary')).data;
  assert.equal(offline.revenueMYR, 11.63); assert.equal(offline.balance, null);
});
test('refill/cancel capability and status guards, operation references, history and deduplication', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o); await f.submit(o);
  const action = kind => f.request('/api/admin/orders/' + o.id + '/' + kind, 'POST', { authorized: true });
  assert.equal((await action('refill')).status, 409);
  assert.equal((await action('cancel')).status, 200); assert.equal((await action('cancel')).status, 409);
  await action('status'); assert.equal((await action('refill')).status, 200); assert.equal((await action('refill')).status, 409);
  assert.equal((await action('refill-status')).data.status, 'Completed');
  const detail = (await f.request('/api/admin/orders/' + o.id)).data;
  assert.equal(detail.operations.length, 2); assert.ok(detail.events.some(e => e.action === 'refill_accepted'));
});
test('unsupported refill/cancel and rejected provider operation remain non-repeatable', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o); await f.submit(o);
  f.mock.control.services = [{ ...service, cancel: false }];
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/cancel', 'POST', { authorized: true })).status, 409);
  f.mock.control.services = [service]; f.mock.control.fail = 'cancel';
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/cancel', 'POST', { authorized: true })).status, 502);
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/cancel', 'POST', { authorized: true })).status, 409);
});
test('custom comments derive quantity and omit upstream quantity parameter', async t => {
  const f = await fixture(t); f.mock.control.services = [{ ...service, type: 'Custom Comments', min: '1' }]; await f.login();
  const details = { ...f.details, quantity: 2, comments: 'Great!\nNice!' };
  const r = await f.checkout(crypto.randomUUID(), details); assert.equal(r.status, 201); await f.confirm(r.data); await f.submit(r.data);
  const call = f.mock.calls.find(c => c.action === 'add'); assert.equal(call.comments, details.comments); assert.equal(call.quantity, undefined);
});
test('CSV export neutralizes formulas and admin headers protect responses', async t => {
  const f = await fixture(t); f.mock.control.services = [{ ...service, name: '=HYPERLINK("evil")' }]; await f.login(); await f.checkout();
  const r = await f.request('/api/admin/export.csv'); assert.equal(r.status, 200); assert.ok(r.data.includes("'=HYPERLINK"));
  assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});
test('login rate limiting and invalid JSON do not leak internal errors', async t => {
  const f = await fixture(t); for (let i = 0; i < 5; i++) assert.equal((await f.request('/api/session', 'POST', { token: 'wrong' })).status, 403);
  assert.equal((await f.request('/api/session', 'POST', { token: credential })).status, 429);
  const r = await fetch(f.base() + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' }); assert.equal(r.status, 400); assert.deepEqual(await r.json(), { error: 'Invalid JSON' });
});

test('dispute review blocks provider spending and requires an audit note', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o);
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/review', 'POST', { disputed: true, note: 'Customer disputes delivery; independently review before spending.' })).status, 200);
  assert.equal((await f.submit(o)).status, 409); assert.equal(f.mock.calls.filter(c => c.action === 'add').length, 0);
  assert.equal((await f.request('/api/admin/summary')).data.disputedOrders, 1);
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/review', 'POST', { disputed: false, note: 'Customer confirmed resolution after independent review.' })).status, 200);
  assert.equal((await f.submit(o)).status, 200);
});
test('service disabled after payment prevents provider spending', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o);
  await f.request('/api/admin/pricing/1', 'PUT', { markup: 30, enabled: false });
  assert.equal((await f.submit(o)).status, 409); assert.equal(f.mock.calls.filter(c => c.action === 'add').length, 0);
});
test('missing provider order ID is ambiguous and duplicate reference cannot attach to another order', async t => {
  const f = await fixture(t); await f.login(); const a = (await f.checkout()).data; await f.confirm(a); f.mock.control.add = null;
  assert.equal((await f.submit(a)).status, 502); assert.equal((await f.submit(a)).status, 409);
  const b = (await f.checkout()).data; await f.confirm(b); f.mock.control.add = 123; await f.submit(b);
  assert.equal((await f.request('/api/admin/orders/' + a.id + '/reconcile', 'POST', { providerOrderId: '123', note: 'Matched order independently against provider account details.' })).status, 409);
});
test('provider status errors and terminal regression preserve stored state', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o); await f.submit(o);
  await f.request('/api/admin/orders/' + o.id + '/status', 'POST', {});
  f.mock.control.status = 'In progress';
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/status', 'POST', {})).status, 409);
  f.mock.control.fail = 'status';
  assert.equal((await f.request('/api/admin/orders/' + o.id + '/status', 'POST', {})).status, 502);
  assert.equal((await f.request('/api/admin/orders/' + o.id)).data.status, 'completed');
});
test('SQL failures roll back order mutation and audit together', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data;
  f.store().db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT,'fixture database failure'); END;");
  const r = await f.request('/api/admin/orders/' + o.id + '/confirm-payment', 'POST', { reference: 'BANK-ROLLBACK', verified: true, amountMYR: o.amountMYR });
  assert.equal(r.status, 500); assert.equal(f.store().order(o.id).status, 'pending_payment');
  assert.equal(f.store().db.prepare('SELECT count(*) AS n FROM payments').get().n, 0);
});
test('production requires explicit secure configuration and issues host-bound secure cookies', async t => {
  assert.throws(() => createApp({ root, env: { NODE_ENV: 'production' } }));
  const f = await fixture(t, { NODE_ENV: 'production', BOOSTER_PUBLIC_ORIGIN: 'https://staging.example.com', BOOSTER_TRUST_PROXY: 'loopback' });
  assert.equal((await f.request('/api/session', 'POST', { token: credential })).status, 400);
  const r = await f.request('/api/session', 'POST', { token: credential }, { 'x-forwarded-proto': 'https', origin: 'https://staging.example.com' });
  assert.equal(r.status, 200); const cookie = r.headers.get('set-cookie');
  assert.match(cookie, /^__Host-booster=/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Strict/); assert.ok(!cookie.includes('Domain='));
  assert.equal(r.headers.get('strict-transport-security'), 'max-age=31536000');
});

test('provider add timeout never retries a possibly accepted paid order', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data; await f.confirm(o);
  f.mock.control.delay = 100; f.mock.control.delayAction = 'add';
  assert.equal((await f.submit(o)).status, 502);
  assert.equal((await f.submit(o)).status, 409);
  assert.equal(f.mock.calls.filter(c => c.action === 'add').length, 1);
  assert.equal(f.store().order(o.id).status, 'reconciliation_required');
});

test('re-verifying a legacy payment cannot release an ambiguous provider submission', async t => {
  const f = await fixture(t); await f.login(); const o = (await f.checkout()).data;
  f.store().tx(() => { const record = f.store().order(o.id); record.status = 'reconciliation_required'; record.paymentReviewRequired = true; f.store().save(record); });
  const r = await f.request('/api/admin/orders/' + o.id + '/confirm-payment', 'POST', { reference: 'LEGACY-VERIFIED', amountMYR: o.amountMYR, verified: true });
  assert.equal(r.status, 200); assert.equal(r.data.status, 'reconciliation_required'); assert.equal((await f.submit(o)).status, 409);
});

test('production Booster subpath serves built assets while API errors stay JSON', async t => {
  const temp = mkdtempSync(path.join(os.tmpdir(), 'ate-routing-'));
  mkdirSync(path.join(temp, 'dist', 'assets'), { recursive: true });
  writeFileSync(path.join(temp, 'dist', 'assets', 'probe.js'), 'console.log("fixture");');
  writeFileSync(path.join(temp, 'dist', 'index.html'), '<main>Fixture Booster</main>');
  const { app, store } = createApp({ root: temp, env: { BOOSTER_DB_PATH: ':memory:' } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); store.close(); rmSync(temp, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const url of ['/assets/probe.js', '/booster/assets/probe.js', '/', '/booster/']) assert.equal((await fetch(base + url)).status, 200, url);
  const missing = await fetch(base + '/api/nonexistent'); assert.equal(missing.status, 404); assert.match(missing.headers.get('content-type'), /application\/json/);
});

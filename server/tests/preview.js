// Local visual QA only: no network provider calls and no persistent customer data.
import { createApp } from '../app.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const services = [
  { service: 1, name: 'Instagram · Premium Likes', category: 'Instagram', type: 'Default', min: '10', max: '10000', rate: '2', refill: true, cancel: true },
  { service: 2, name: 'TikTok · Video Views', category: 'TikTok', type: 'Default', min: '100', max: '100000', rate: '0.5', refill: false, cancel: false },
  { service: 3, name: 'Instagram · Custom Comments', category: 'Instagram', type: 'Custom Comments', min: '1', max: '100', rate: '8', refill: false, cancel: true },
];
let nextId = 100;
const { app, store } = createApp({ root, env: { BOOSTER_PUBLIC_ORIGIN: 'http://127.0.0.1:3000', BOOSTER_DB_PATH: ':memory:', BOOSTER_ADMIN_TOKEN: 'fixture-credential-with-at-least-32-characters', PADOONSTA_API_KEY: 'mock-only' }, fetchImpl: async (_url, options) => {
  const p = Object.fromEntries(options.body);
  return Response.json({ services, balance: { balance: '124.70', currency: 'USD' }, add: { order: ++nextId }, status: { status: 'Completed', charge: '2', currency: 'USD', remains: '0', start_count: '100' }, refill: { refill: '7' }, cancel: [{ order: p.orders, cancel: 1 }], refill_status: { status: 'Completed' } }[p.action]);
} });
const server = app.listen(3000, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:3000';
  const login = await fetch(base + '/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 'fixture-credential-with-at-least-32-characters' }) });
  const { csrf } = await login.json(), cookie = login.headers.get('set-cookie').split(';')[0];
  for (let i = 0; i < 3; i++) {
    const response = await fetch(base + '/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, body: JSON.stringify({ service: 1, quantity: 1000, link: 'https://instagram.com/demo' + i }) });
    const o = await response.json();
    if (i > 0) await fetch(base + '/api/admin/orders/' + o.id + '/confirm-payment', { method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf }, body: JSON.stringify({ verified: true, reference: 'FIXTURE-' + i, amountMYR: o.amountMYR }) });
    if (i > 1) { for (const action of ['submit', 'status']) await fetch(base + '/api/admin/orders/' + o.id + '/' + action, { method: 'POST', headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrf }, body: JSON.stringify({ authorized: true }) }); }
  }
  console.log('Mock-only visual QA ready: ' + base);
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => { store.close(); process.exit(0); }));

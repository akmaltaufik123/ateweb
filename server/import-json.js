import { readFileSync } from 'node:fs';
import { openStore } from './store.js';
import { cents, requireThat, numeric } from './domain.js';

export function importLegacy(store, legacy) {
  const { db, tx, event } = store;
  requireThat(Array.isArray(legacy.orders) && legacy.pricing && typeof legacy.pricing === 'object' && Array.isArray(legacy.events), 400, 'Invalid legacy store');
  return tx(() => {
    requireThat(db.prepare('SELECT count(*) AS n FROM orders').get().n === 0 && db.prepare('SELECT count(*) AS n FROM events').get().n === 0 && db.prepare('SELECT count(*) AS n FROM pricing').get().n === 0, 409, 'Import requires an empty destination');
    for (const original of legacy.orders) {
      requireThat(typeof original.id === 'string' && /^[a-zA-Z0-9-]{16,128}$/.test(original.id) && numeric(original.saleMYR, 0.01, 1000000) && numeric(original.costMYR, 0, 1000000), 400, 'Invalid legacy order');
      const o = { ...original, saleCents: cents(original.saleMYR), costCents: cents(original.costMYR), fx: Number(original.fx || 4.47), providerCurrency: original.providerCurrency || 'USD', providerRate: original.providerRate || null, serviceType: original.serviceType || 'Default', whatsapp: '60189451570', refill: false, cancel: false };
      if (o.status === 'submitting') o.status = 'reconciliation_required';
      // Legacy paid flags have no independent payment record. Preserve claim as evidence only.
      if (o.paidAt || o.status === 'paid') { o.legacyPaymentClaim = { paidAt: o.paidAt || null, status: original.status }; o.paymentReviewRequired = true; delete o.paidAt; if (original.status === 'paid' && !o.providerOrderId) o.status = 'pending_payment'; }
      if (o.providerOrderId) o.providerOrderId = String(o.providerOrderId);
      db.prepare('INSERT INTO orders VALUES(?,?,?,?,?)').run(o.id, 'legacy-' + o.id, 'legacy-import', o.providerOrderId || null, JSON.stringify(o));
      event('migration', 'legacy_order_imported', o.id, { originalStatus: original.status, paymentReviewRequired: Boolean(o.paymentReviewRequired) });
    }
    for (const [id, value] of Object.entries(legacy.pricing)) {
      requireThat(/^\d+$/.test(id) && numeric(value.markup, 0, 10000) && typeof value.enabled === 'boolean', 400, 'Invalid legacy pricing');
      db.prepare('INSERT INTO pricing VALUES(?,?)').run(id, JSON.stringify({ markup: Number(value.markup), enabled: value.enabled, sellingRateMYR: null }));
    }
    for (const e of legacy.events) event('legacy', 'legacy_event', typeof e.orderId === 'string' ? e.orderId : null, { legacyAt: e.at, legacyAction: e.action });
    event('migration', 'legacy_import_completed', null, { orders: legacy.orders.length });
    return legacy.orders.length;
  });
}
if (process.argv[1]?.endsWith('import-json.js')) {
  const [source, destination] = process.argv.slice(2);
  requireThat(source && destination, 400, 'Usage: npm run db:import -- /backup/booster.json /persistent/booster.sqlite');
  const store = openStore(destination);
  try { console.log('Imported orders:', importLegacy(store, JSON.parse(readFileSync(source, 'utf8')))); } finally { store.close(); }
}

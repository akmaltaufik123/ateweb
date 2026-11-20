import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openStore } from '../store.js';
import { importLegacy } from '../import-json.js';

test('transaction rollback, legacy migration safety, backup and restore', t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'ate-migration-')), file = path.join(dir, 'store.sqlite'), backup = path.join(dir, 'backup.sqlite');
  const store = openStore(file); t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  const o = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', saleMYR: 10, costMYR: 5, service: 1, link: 'https://example.com', quantity: 1000, status: 'paid', paidAt: '2026-01-01' };
  const uncertain = { ...o, id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', status: 'submitting' };
  const legacy = { orders: [o, uncertain], pricing: { '1': { markup: 30, enabled: true } }, events: [{ at: '2026-01-01', action: 'payment_confirmed', orderId: o.id }] };
  assert.throws(() => importLegacy(store, { ...legacy, orders: [o, { ...o, id: 'invalid' }] }));
  assert.equal(store.orders().length, 0); assert.equal(store.events().length, 0);
  assert.equal(importLegacy(store, legacy), 2);
  const imported = store.order(o.id);
  assert.equal(imported.status, 'pending_payment'); assert.equal(imported.paidAt, undefined); assert.equal(imported.paymentReviewRequired, true); assert.equal(imported.saleCents, 1000);
  assert.equal(store.order(uncertain.id).status, 'reconciliation_required');
  assert.throws(() => importLegacy(store, legacy));
  const result = spawnSync(process.execPath, ['server/backup.js', file, backup], { encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
  const restored = new DatabaseSync(backup, { readOnly: true });
  try { assert.equal(restored.prepare('SELECT count(*) AS n FROM orders').get().n, 2); assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); } finally { restored.close(); }
  assert.equal(spawnSync(process.execPath, ['server/backup.js', file, backup], { encoding: 'utf8', timeout: 10000 }).status, 1);
});

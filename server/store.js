import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function openStore(filename) {
  if (filename !== ':memory:') mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
  // Versioned, transactional migration. UNIQUE references also protect across processes.
  db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, idempotency TEXT NOT NULL UNIQUE, fingerprint TEXT NOT NULL, provider_id TEXT UNIQUE, data TEXT NOT NULL CHECK(json_valid(data)));
    CREATE TABLE IF NOT EXISTS pricing(id TEXT PRIMARY KEY, data TEXT NOT NULL CHECK(json_valid(data)));
    CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL CHECK(json_valid(data)));
    CREATE TABLE IF NOT EXISTS payments(order_id TEXT PRIMARY KEY REFERENCES orders(id), reference TEXT NOT NULL UNIQUE, amount_cents INTEGER NOT NULL CHECK(amount_cents>0), actor TEXT NOT NULL, at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, at TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, order_id TEXT, data TEXT NOT NULL CHECK(json_valid(data)));
    CREATE TABLE IF NOT EXISTS operations(id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), kind TEXT NOT NULL, state TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), UNIQUE(order_id,kind));
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, actor TEXT NOT NULL, expires INTEGER NOT NULL);
    INSERT OR IGNORE INTO migrations VALUES(1,datetime('now'));
    COMMIT;`);
  const tx = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const order = id => { const row = db.prepare('SELECT data FROM orders WHERE id=?').get(id); return row ? JSON.parse(row.data) : null; };
  const save = o => db.prepare('UPDATE orders SET provider_id=?,data=? WHERE id=?').run(o.providerOrderId == null ? null : String(o.providerOrderId), JSON.stringify(o), o.id);
  const event = (actor, action, orderId = null, data = {}) => db.prepare('INSERT INTO events(at,actor,action,order_id,data) VALUES(?,?,?,?,?)').run(new Date().toISOString(), actor, action, orderId, JSON.stringify(data));
  return { db, tx, order, save, event,
    orders: () => db.prepare('SELECT data FROM orders ORDER BY rowid DESC').all().map(r => JSON.parse(r.data)),
    events: (id = null) => db.prepare('SELECT * FROM events WHERE (? IS NULL OR order_id=?) ORDER BY id DESC LIMIT 1000').all(id, id).map(r => ({ ...r, data: JSON.parse(r.data) })),
    pricing: () => Object.fromEntries(db.prepare('SELECT * FROM pricing').all().map(r => [r.id, JSON.parse(r.data)])),
    close: () => db.close(),
  };
}

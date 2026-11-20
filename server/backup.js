import { DatabaseSync, backup } from 'node:sqlite';
import { chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { requireThat } from './domain.js';

const [source, destination] = process.argv.slice(2);
requireThat(source && destination && path.resolve(source) !== path.resolve(destination) && existsSync(source) && !existsSync(destination), 400, 'Usage: npm run db:backup -- existing.sqlite new-backup.sqlite (destination must not exist)');
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, destination);
  chmodSync(destination, 0o600);
  const verification = new DatabaseSync(destination, { readOnly: true });
  try { requireThat(verification.prepare('PRAGMA integrity_check').get().integrity_check === 'ok', 500, 'Backup integrity check failed'); }
  finally { verification.close(); }
  console.log('Backup created and integrity verified.');
} finally { db.close(); }

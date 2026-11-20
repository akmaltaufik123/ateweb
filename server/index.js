import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createApp } from './app.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const { app, store } = createApp({ root });
const server = app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => console.log('ATE Booster server ready'));
server.requestTimeout = 30000;
server.headersTimeout = 15000;
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  server.close(() => { store.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10000).unref();
});

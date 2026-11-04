import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(envDir, '../.env') });
dotenv.config();

import './dns-fallback.js';
import { createPgDb } from './db.js';
import { migrate } from './migrate.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
  process.exit(1);
}

const db = createPgDb(process.env.DATABASE_URL);
try {
  const applied = await migrate(db);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is already up to date.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await db.close();
}

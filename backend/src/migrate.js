import fs from 'node:fs/promises';
import path from 'node:path';
import { backendRoot } from './config.js';

/** Runs every sql/*.sql file that has not been applied yet, in name order. */
export async function migrate(db, dir = path.join(backendRoot, 'sql')) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const applied = [];
  for (const file of files) {
    const done = await db.query('SELECT 1 FROM schema_migrations WHERE name = $1', [file]);
    if (done.rows.length > 0) continue;
    const sql = await fs.readFile(path.join(dir, file), 'utf8');
    await db.tx(async (t) => {
      await t.exec(sql);
      await t.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    applied.push(file);
  }
  return applied;
}

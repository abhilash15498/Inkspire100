import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const envDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(envDir, '../.env') });
dotenv.config();

import './dns-fallback.js';
import { loadConfig, assertConfig } from './config.js';
import { createPgDb } from './db.js';
import { migrate } from './migrate.js';
import { createStorage } from './storage/index.js';
import { createGoogleVerifier } from './services/google.js';
import { createApp } from './app.js';

const config = loadConfig();
try {
  assertConfig(config);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const db = createPgDb(config.databaseUrl);
const applied = await migrate(db);
if (applied.length) console.log('Database updated:', applied.join(', '));

if (config.googleClientId === 'dev-mode') {
  try {
    await db.query(
      `INSERT INTO reviewer_access (email, note)
       VALUES ('reviewer@example.com', 'Dev demo reviewer')
       ON CONFLICT (email) DO NOTHING`
    );
    const existing = await db.query('SELECT count(*)::int as count FROM chapters');
    if (existing.rows[0]?.count === 0) {
      const sampleText = 'It was a quiet afternoon when the manuscript arrived on the desk.\n\n***\n\nEvery journey begins with a single line of thought.';
      const ins = await db.query(
        `INSERT INTO chapters (chapter_number, title, content, is_published, published_version)
         VALUES (1, 'Chapter 1: The Beginning', $1, true, 1)
         RETURNING id`,
        [sampleText]
      );
      const chId = ins.rows[0].id;
      await db.query(
        `INSERT INTO chapter_versions (chapter_id, version_number, title, content, word_count, change_note)
         VALUES ($1, 1, 'Chapter 1: The Beginning', $2, 20, 'First published version')`,
        [chId, sampleText]
      );
    }
  } catch (seedErr) {
    // Non-fatal if already seeded
  }
}

const app = createApp({
  config,
  db,
  storage: createStorage(config),
  verifyGoogle: createGoogleVerifier(config.googleClientId),
});

const server = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port} (${config.nodeEnv}, storage: ${config.storage.provider})`);
  if (config.googleClientId === 'dev-mode') {
    console.log('[dev] Zero-setup local mode active (Author: author@example.com | Reviewer: reviewer@example.com)');
  }
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => db.close().finally(() => process.exit(0)));
  });
}

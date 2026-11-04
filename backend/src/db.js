import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDevDbDir = path.resolve(here, '../.dev-db');

/**
 * Database wrapper. When connectionString is 'local' or 'memory', uses embedded PGlite.
 * In production or with a postgresql:// URL, connects to Neon PostgreSQL.
 * Every query uses numbered parameters ($1, $2 ...) so user input is never pasted into SQL.
 *
 * Interface: query(text, params), exec(sql), tx(fn), close()
 */
export function createPgDb(connectionString) {
  if (connectionString === 'local' || connectionString === 'memory' || !connectionString) {
    const dataDir = connectionString === 'memory' ? undefined : defaultDevDbDir;
    const pglite = new PGlite(dataDir);
    const wrap = (c) => ({
      query: async (text, params = []) => {
        const r = await c.query(text, params);
        return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
      },
      exec: async (sql) => {
        await c.exec(sql);
      },
    });
    return {
      ...wrap(pglite),
      tx: (fn) => pglite.transaction((t) => fn(wrap(t))),
      close: () => pglite.close(),
    };
  }

  const pool = new pg.Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000, // Neon can take a few seconds to wake up
  });
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));

  const wrap = (c) => ({
    query: (text, params) => c.query(text, params),
    exec: (sql) => c.query(sql),
  });

  return {
    ...wrap(pool),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

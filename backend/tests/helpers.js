import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { loadConfig } from '../src/config.js';
import { migrate } from '../src/migrate.js';
import { LocalStorage } from '../src/storage/local.js';
import { createApp } from '../src/app.js';

/** An in-memory real PostgreSQL (PGlite) wrapped in the same interface as src/db.js. */
export async function createTestDb() {
  const pg = new PGlite();
  const wrap = (c) => ({
    query: async (text, params = []) => {
      const r = await c.query(text, params);
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
    },
    exec: async (sql) => {
      await c.exec(sql);
    },
  });
  return { ...wrap(pg), tx: (fn) => pg.transaction((t) => fn(wrap(t))), close: () => pg.close() };
}

export const AUTHOR = { email: 'author@example.com', sub: 'sub-author', name: 'The Author' };
export const ALICE = { email: 'alice@example.com', sub: 'sub-alice', name: 'Alice Reviewer' };
export const BOB = { email: 'bob@example.com', sub: 'sub-bob', name: 'Bob Reviewer' };

/** Fake Google check: the "credential" is a JSON string we create in tests. */
export const fakeCredential = (u, extra = {}) => JSON.stringify({ ...u, emailVerified: true, ...extra });
const fakeVerify = async (cred) => {
  let p;
  try {
    p = JSON.parse(cred);
  } catch {
    throw new Error('bad token');
  }
  return { sub: p.sub, email: p.email, emailVerified: p.emailVerified, name: p.name };
};

export async function startTestServer(overrides = {}) {
  const db = await createTestDb();
  await migrate(db);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'novel-test-'));
  const config = loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'x',
    GOOGLE_CLIENT_ID: 'test-client',
    AUTHOR_EMAILS: AUTHOR.email,
    SESSION_SECRET: 'x'.repeat(40),
    LOCAL_STORAGE_DIR: dir,
    DISABLE_RATE_LIMIT: 'true',
    MAX_UPLOAD_MB: '1',
    STATIC_DIR: path.join(dir, 'no-static'),
    ...overrides,
  });
  const storage = new LocalStorage(dir);
  const app = createApp({ config, db, storage, verifyGoogle: fakeVerify });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    db,
    config,
    storage,
    storageDir: dir,
    async close() {
      await new Promise((r) => server.close(r));
      await db.close();
      await fs.rm(dir, { recursive: true, force: true });
    },
    client: () => new Client(base),
  };
}

/** A tiny HTTP client that remembers cookies, like a browser. */
export class Client {
  constructor(base) {
    this.base = base;
    this.cookie = '';
  }

  async request(method, url, { body, form, headers = {}, csrf = true } = {}) {
    const h = { ...headers };
    if (csrf) h['X-Requested-With'] = 'fetch';
    if (this.cookie) h.Cookie = this.cookie;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(this.base + url, { method, headers: h, body: payload });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const [name, ...rest] = pair.split('=');
      const value = rest.join('=');
      const others = this.cookie.split('; ').filter((x) => x && !x.startsWith(name + '='));
      this.cookie = value ? [...others, `${name}=${value}`].join('; ') : others.join('; ');
    }
    const type = res.headers.get('content-type') || '';
    let data = null;
    let buffer = null;
    if (type.includes('application/json')) data = await res.json();
    else buffer = Buffer.from(await res.arrayBuffer());
    return { status: res.status, data, buffer, headers: res.headers };
  }

  get = (url, o) => this.request('GET', url, o);
  post = (url, body, o) => this.request('POST', url, { body, ...o });
  put = (url, body, o) => this.request('PUT', url, { body, ...o });
  patch = (url, body, o) => this.request('PATCH', url, { body, ...o });
  del = (url, o) => this.request('DELETE', url, o);

  login(user, extra) {
    return this.post('/api/auth/google', { credential: fakeCredential(user, extra) });
  }
}

/** Server + a signed-in author + invited, signed-in reviewers Alice and Bob. */
export async function setup() {
  const t = await startTestServer();
  const author = t.client();
  assertStatus(await author.login(AUTHOR), 200);
  assertStatus(await author.post('/api/author/reviewers', { emails: `${ALICE.email}, ${BOB.email}` }), 201);
  const alice = t.client();
  const bob = t.client();
  assertStatus(await alice.login(ALICE), 200);
  assertStatus(await bob.login(BOB), 200);
  return { ...t, author, alice, bob };
}

export function assertStatus(res, expected) {
  if (res.status !== expected) {
    throw new Error(`Expected HTTP ${expected} but got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return res;
}

/** Creates a chapter and publishes it. Returns the chapter id. */
export async function publishedChapter(author, number, title, content, note = '') {
  const c = assertStatus(await author.post('/api/author/chapters', { number, title, content }), 201).data.chapter;
  assertStatus(await author.post(`/api/author/chapters/${c.id}/publish`, { changeNote: note }), 200);
  return c.id;
}

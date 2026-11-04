import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, startTestServer, assertStatus, publishedChapter, fakeCredential, ALICE, BOB, AUTHOR } from './helpers.js';

let t;
let chapterId;
before(async () => {
  t = await setup();
  chapterId = await publishedChapter(t.author, 1, 'Test chapter (sample)', 'Sample text for testing.');
});
after(() => t.close());

test('uninvited Google account cannot sign in and is not stored', async () => {
  const c = t.client();
  const res = await c.login({ email: 'stranger@example.com', sub: 'sub-x', name: 'Stranger' });
  assert.equal(res.status, 403);
  assert.equal(res.data.code, 'not_invited');
  const users = await t.db.query("SELECT 1 FROM users WHERE email = 'stranger@example.com'");
  assert.equal(users.rows.length, 0);
});

test('bad tokens and unverified emails are rejected', async () => {
  const c = t.client();
  assert.equal((await c.post('/api/auth/google', { credential: 'not-a-token' })).status, 401);
  assert.equal((await c.post('/api/auth/google', {})).status, 400);
  assert.equal((await c.login(ALICE, { emailVerified: false })).status, 403);
});

test('email matching ignores capitalisation', async () => {
  const c = t.client();
  assert.equal((await c.login({ ...ALICE, email: 'ALICE@Example.com' })).status, 200);
});

test('author and reviewers get the right roles', async () => {
  assert.equal((await t.author.get('/api/auth/me')).data.user.role, 'author');
  assert.equal((await t.alice.get('/api/auth/me')).data.user.role, 'reviewer');
  assert.equal((await t.client().get('/api/auth/me')).status, 401);
});

test('signed-out visitors cannot read private content', async () => {
  const c = t.client();
  for (const url of ['/api/chapters', `/api/chapters/${chapterId}`, '/api/book', '/api/me/feedback']) {
    assert.equal((await c.get(url)).status, 401, url);
  }
});

test('reviewers are blocked from every author route (enforced by the server)', async () => {
  const routes = [
    ['get', '/api/author/chapters'],
    ['post', '/api/author/chapters', { number: 9, title: 'x' }],
    ['get', `/api/author/chapters/${chapterId}`],
    ['put', `/api/author/chapters/${chapterId}`, { title: 'hacked' }],
    ['post', `/api/author/chapters/${chapterId}/publish`, {}],
    ['post', `/api/author/chapters/${chapterId}/unpublish`, {}],
    ['delete', `/api/author/chapters/${chapterId}`],
    ['get', `/api/author/chapters/${chapterId}/versions`],
    ['get', `/api/author/chapters/${chapterId}/versions/1`],
    ['post', `/api/author/chapters/${chapterId}/versions/1/restore`, {}],
    ['post', `/api/author/chapters/${chapterId}/import`, {}],
    ['get', '/api/author/files/1/download'],
    ['delete', '/api/author/files/1'],
    ['get', '/api/author/feedback'],
    ['patch', '/api/author/feedback/1', { isRead: true }],
    ['get', '/api/author/reviewers'],
    ['post', '/api/author/reviewers', { emails: 'x@example.com' }],
    ['delete', '/api/author/reviewers/1'],
    ['put', '/api/author/book', { title: 'x' }],
  ];
  for (const [method, url, body] of routes) {
    const res = await t.alice[method === 'delete' ? 'del' : method](url, body);
    assert.equal(res.status, 403, `${method.toUpperCase()} ${url} should be 403, got ${res.status}`);
  }
  // ...and nothing changed.
  const ch = (await t.author.get(`/api/author/chapters/${chapterId}`)).data.chapter;
  assert.equal(ch.title, 'Test chapter (sample)');
});

test('removing a reviewer locks them out immediately, reinstating lets them back in', async () => {
  const c = t.client();
  assertStatus(await c.login(BOB), 200);
  const list = (await t.author.get('/api/author/reviewers')).data.reviewers;
  const bob = list.find((r) => r.email === BOB.email);
  assertStatus(await t.author.patch(`/api/author/reviewers/${bob.id}`, { revoked: true }), 200);
  assert.equal((await c.get('/api/chapters')).status, 401);
  assert.equal((await t.client().login(BOB)).status, 403);
  assertStatus(await t.author.patch(`/api/author/reviewers/${bob.id}`, { revoked: false }), 200);
  assert.equal((await t.client().login(BOB)).status, 200);
});

test('author email cannot be listed as a reviewer', async () => {
  const res = assertStatus(await t.author.post('/api/author/reviewers', { emails: AUTHOR.email }), 201);
  assert.deepEqual(res.data.skippedAuthor, [AUTHOR.email]);
});

test('reviewer input validation', async () => {
  assert.equal((await t.author.post('/api/author/reviewers', { emails: 'not-an-email' })).status, 400);
  assert.equal((await t.author.post('/api/author/reviewers', {})).status, 400);
});

test('requests that change data need the security header (CSRF guard)', async () => {
  const res = await t.author.post('/api/author/chapters', { number: 50, title: 'x' }, { csrf: false });
  assert.equal(res.status, 403);
  const res2 = await t.author.request('POST', '/api/author/chapters', {
    body: { number: 50, title: 'x' },
    headers: { Origin: 'https://evil.example' },
  });
  assert.equal(res2.status, 403);
});

test('security headers are sent and the session cookie is HttpOnly', async () => {
  const raw = await fetch(t.base + '/api/health');
  assert.ok(raw.headers.get('content-security-policy'));
  assert.equal(raw.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(raw.headers.get('x-powered-by'), null);
  const login = await fetch(t.base + '/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
    body: JSON.stringify({ credential: fakeCredential(ALICE) }),
  });
  const cookie = login.headers.getSetCookie().join(';');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
});

test('errors do not leak internals; malformed ids are 404; bad JSON is 400', async () => {
  assert.equal((await t.author.get('/api/author/chapters/1;DROP TABLE chapters')).status, 404);
  assert.equal((await t.author.get('/api/author/feedback?chapterId=1%20OR%201=1')).status, 404);
  const res = await t.author.request('POST', '/api/author/chapters', {
    headers: { 'Content-Type': 'application/json' },
    form: '{"broken',
  });
  assert.equal(res.status, 400);
  assert.equal((await t.author.get('/api/nope')).status, 404);
});

test('SQL injection text is stored as plain text, not executed', async () => {
  const evil = "'); DROP TABLE chapters; --";
  const res = assertStatus(await t.author.post('/api/author/chapters', { number: 77, title: evil, content: evil }), 201);
  assert.equal(res.data.chapter.title, evil);
  assert.equal((await t.author.get('/api/author/chapters')).status, 200);
});

test('cookie is Secure and cross-site when CROSS_SITE_COOKIES=true', async () => {
  const x = await startTestServer({ CROSS_SITE_COOKIES: 'true', APP_ORIGIN: 'https://site.example' });
  try {
    await x.client().post('/api/author/reviewers', { emails: 'a@b.co' }); // unauthenticated: ignored
    const login = await fetch(x.base + '/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({ credential: fakeCredential(AUTHOR) }),
    });
    const cookie = login.headers.getSetCookie().join(';');
    assert.match(cookie, /SameSite=None/i);
    assert.match(cookie, /Secure/i);
    // CORS only allows the configured site.
    const pre = await fetch(x.base + '/api/chapters', { headers: { Origin: 'https://site.example' } });
    assert.equal(pre.headers.get('access-control-allow-origin'), 'https://site.example');
    const evil = await fetch(x.base + '/api/chapters', { headers: { Origin: 'https://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
  } finally {
    await x.close();
  }
});

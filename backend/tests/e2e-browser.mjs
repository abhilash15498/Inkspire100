// Real-browser smoke test: node backend/tests/e2e-browser.mjs  (needs `npm run build` first and Playwright)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startTestServer, assertStatus, AUTHOR, ALICE } from './helpers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const t = await startTestServer({ STATIC_DIR: path.join(root, 'frontend/dist') });
const author = t.client();
assertStatus(await author.login(AUTHOR), 200);
assertStatus(await author.post('/api/author/reviewers', { emails: ALICE.email }), 201);
const alice = t.client();
assertStatus(await alice.login(ALICE), 200);
const ch = assertStatus(await author.post('/api/author/chapters', { number: 1, title: 'Sample chapter (test data)', content: 'First *line*.\n\n***\n\nSecond line.' }), 201).data.chapter;
assertStatus(await author.post(`/api/author/chapters/${ch.id}/publish`, { changeNote: 'first' }), 200);

const browser = await chromium.launch();
const problems = [];
const check = (c, m) => { if (!c) problems.push(m); console.log(c ? 'ok  ' : 'FAIL', m); };

async function pageFor(client) {
  const ctx = await browser.newContext();
  const [name, value] = client.cookie.split('=');
  await ctx.addCookies([{ name, value, url: t.base }]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/accounts.google|gsi|ERR_|Failed to load resource/.test(m.text()) && problems.push('console: ' + m.text()));
  return page;
}

try {
  // signed out -> login
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(t.base + '/chapters');
  await anon.waitForURL('**/login');
  check(await anon.getByText('invited readers only').isVisible(), 'signed-out visitor is sent to the login page');

  // reviewer
  const r = await pageFor(alice);
  await r.goto(t.base + `/chapters/${ch.id}`);
  await r.getByRole('heading', { name: 'Sample chapter (test data)' }).waitFor();
  check((await r.locator('.prose em').innerText()) === 'line', 'reader renders formatted chapter text');
  await r.getByLabel(/What did you think/).fill('Lovely opening.');
  await r.getByRole('button', { name: 'Send feedback' }).click();
  await r.getByText('Thank you. Your feedback was sent.').waitFor();
  check(await r.getByText('Lovely opening.').first().isVisible(), 'reviewer can submit feedback');
  await r.goto(t.base + '/author');
  check(await r.getByText('Only the author can open this page').isVisible(), 'reviewer sees "not allowed" on author page');

  // author
  const a = await pageFor(author);
  await a.goto(t.base + '/author');
  await a.getByRole('heading', { name: 'Your chapters' }).waitFor();
  check(await a.getByText('1 new').isVisible(), 'author dashboard shows unread feedback');
  await a.getByRole('link', { name: 'Sample chapter (test data)' }).click();
  await a.getByLabel('Title').waitFor();
  const area = a.getByLabel('Chapter text');
  await area.fill('First *line*, corrected.\n\n***\n\nSecond line.');
  await a.getByRole('button', { name: 'Save draft' }).click();
  await a.getByText('Draft saved').waitFor();
  await a.getByRole('button', { name: 'Publish changes…' }).click();
  await a.getByLabel(/What changed/).fill('Fixed a line');
  await a.getByRole('button', { name: 'Confirm and publish' }).click();
  await a.getByText('Published as version 2').waitFor();
  check(true, 'author can edit, save draft and publish a correction');
  await a.getByRole('tab', { name: 'Version history' }).click();
  await a.getByText('v1').waitFor();
  check(await a.getByText('Live').isVisible(), 'version history lists versions');
  await a.getByRole('tab', { name: 'Upload a file' }).click();
  check(await a.getByRole('button', { name: 'Import text into draft' }).isVisible(), 'upload tab renders');
  await a.goto(t.base + '/author/feedback');
  await a.getByText('Lovely opening.').waitFor();
  check(await a.locator('.feedback-item').getByText(/Alice Reviewer/).isVisible(), 'feedback inbox identifies the reviewer');
  await a.goto(t.base + '/author/reviewers');
  await a.locator('table').getByText(ALICE.email).waitFor();
  check(true, 'reviewer management page lists reviewers');
} catch (e) {
  problems.push(String(e.stack || e));
} finally {
  await browser.close();
  await t.close();
}
if (problems.length) { console.log('\nPROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log('\nAll browser checks passed.');

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, assertStatus, publishedChapter } from './helpers.js';

let t;
let ch1;
let ch2;
before(async () => {
  t = await setup();
  ch1 = await publishedChapter(t.author, 1, 'One (sample)', 'Sample text one.');
  ch2 = await publishedChapter(t.author, 2, 'Two (sample)', 'Sample text two.');
});
after(() => t.close());

test('reviewer submits feedback with a category; validation applies', async () => {
  const ok = assertStatus(await t.alice.post(`/api/chapters/${ch1}/feedback`, { comment: 'The opening is slow.', category: 'pacing' }), 201);
  assert.equal(ok.data.feedback.category, 'pacing');
  assert.equal(ok.data.feedback.version, 1);
  assert.equal((await t.alice.post(`/api/chapters/${ch1}/feedback`, { comment: '   ' })).status, 400);
  assert.equal((await t.alice.post(`/api/chapters/${ch1}/feedback`, { comment: 'x'.repeat(5001) })).status, 400);
  assert.equal((await t.alice.post(`/api/chapters/${ch1}/feedback`, { comment: 'hi', category: 'bogus' })).status, 400);
  assert.equal((await t.alice.post('/api/chapters/99999/feedback', { comment: 'hi' })).status, 404);
});

test('feedback is private to each reviewer', async () => {
  assertStatus(await t.bob.post(`/api/chapters/${ch1}/feedback`, { comment: 'Bob thinks the dialogue is great.', category: 'writing' }), 201);
  const mine = (await t.alice.get(`/api/chapters/${ch1}/feedback`)).data.feedback;
  assert.ok(mine.every((f) => !f.comment.includes('Bob')));
  const all = (await t.alice.get('/api/me/feedback')).data.feedback;
  assert.ok(all.every((f) => !f.comment.includes('Bob')));
});

test("a reviewer cannot edit or delete someone else's feedback", async () => {
  const bobsId = (await t.bob.get('/api/me/feedback')).data.feedback[0].id;
  assert.equal((await t.alice.put(`/api/feedback/${bobsId}`, { comment: 'Hijacked' })).status, 404);
  assert.equal((await t.alice.del(`/api/feedback/${bobsId}`)).status, 404);
  const still = (await t.bob.get('/api/me/feedback')).data.feedback[0];
  assert.match(still.comment, /Bob thinks/);
});

test('a reviewer can edit and delete their own feedback; editing marks it unread again', async () => {
  const created = assertStatus(await t.alice.post(`/api/chapters/${ch2}/feedback`, { comment: 'First thought.', category: 'plot' }), 201).data.feedback;
  assertStatus(await t.author.patch(`/api/author/feedback/${created.id}`, { isRead: true }), 200);
  const edited = assertStatus(await t.alice.put(`/api/feedback/${created.id}`, { comment: 'Second thought.' }), 200).data.feedback;
  assert.equal(edited.comment, 'Second thought.');
  assert.equal(edited.category, 'plot'); // untouched
  const inbox = (await t.author.get('/api/author/feedback')).data.feedback.find((f) => f.id === created.id);
  assert.equal(inbox.isRead, false);
  assertStatus(await t.alice.del(`/api/feedback/${created.id}`), 200);
  assert.ok(!(await t.alice.get('/api/me/feedback')).data.feedback.some((f) => f.id === created.id));
});

test('author inbox: identifies reviewers, filters, orders chronologically, tracks read state', async () => {
  const all = (await t.author.get('/api/author/feedback')).data.feedback;
  assert.ok(all.length >= 2);
  const first = all[0];
  assert.ok(first.reviewer.email && first.reviewer.name);
  const times = all.map((f) => new Date(f.createdAt).getTime());
  assert.deepEqual(times, [...times].sort((a, b) => a - b)); // oldest first by default
  const newest = (await t.author.get('/api/author/feedback?order=newest')).data.feedback;
  assert.equal(newest[0].id, all[all.length - 1].id);

  const byChapter = (await t.author.get(`/api/author/feedback?chapterId=${ch1}`)).data.feedback;
  assert.ok(byChapter.length >= 2 && byChapter.every((f) => f.chapterId === ch1));
  const aliceId = all.find((f) => f.reviewer.email === 'alice@example.com').reviewer.id;
  const byReviewer = (await t.author.get(`/api/author/feedback?reviewerId=${aliceId}`)).data.feedback;
  assert.ok(byReviewer.length >= 1 && byReviewer.every((f) => f.reviewer.id === aliceId));

  const unread = (await t.author.get('/api/author/feedback?unread=true')).data.feedback;
  assert.equal(unread.length, all.filter((f) => !f.isRead).length);
  assertStatus(await t.author.patch(`/api/author/feedback/${unread[0].id}`, { isRead: true }), 200);
  const done = assertStatus(await t.author.post('/api/author/feedback/mark-read', {}), 200);
  assert.ok(done.data.updated >= 0);
  assert.equal((await t.author.get('/api/author/feedback?unread=true')).data.feedback.length, 0);
  assert.equal((await t.author.patch(`/api/author/feedback/${unread[0].id}`, { isRead: 'yes' })).status, 400);
});

test('reviewers see when a chapter changed after their feedback', async () => {
  let row = (await t.alice.get('/api/chapters')).data.chapters.find((c) => c.id === ch1);
  assert.equal(row.updatedSinceMyFeedback, false);
  assertStatus(await t.author.put(`/api/author/chapters/${ch1}`, { content: 'Sample text one, revised.' }), 200);
  assertStatus(await t.author.post(`/api/author/chapters/${ch1}/publish`, { changeNote: 'Tightened the opening' }), 200);
  row = (await t.alice.get('/api/chapters')).data.chapters.find((c) => c.id === ch1);
  assert.equal(row.updatedSinceMyFeedback, true);
  assert.equal(row.version, 2);
  const fb = (await t.alice.get(`/api/chapters/${ch1}/feedback`)).data.feedback[0];
  assert.equal(fb.version, 1);
  assert.equal(fb.currentVersion, 2);
  assert.equal(fb.chapterUpdatedSince, true);
  const inbox = (await t.author.get(`/api/author/feedback?chapterId=${ch1}`)).data.feedback;
  assert.ok(inbox.every((f) => f.chapterUpdatedSince));
  // New feedback is recorded against the new version.
  const newer = assertStatus(await t.alice.post(`/api/chapters/${ch1}/feedback`, { comment: 'Better now.' }), 201).data.feedback;
  assert.equal(newer.version, 2);
});

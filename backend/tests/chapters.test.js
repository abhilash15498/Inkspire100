import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, assertStatus, publishedChapter } from './helpers.js';

let t;
before(async () => {
  t = await setup();
});
after(() => t.close());

const A = '/api/author/chapters';

test('create a draft: reviewers cannot see it, author can', async () => {
  const res = assertStatus(await t.author.post(A, { number: 1, title: 'Draft chapter (sample)', content: 'First draft text.' }), 201);
  const id = res.data.chapter.id;
  assert.equal(res.data.chapter.status, 'draft');
  assert.equal((await t.alice.get('/api/chapters')).data.chapters.length, 0);
  assert.equal((await t.alice.get(`/api/chapters/${id}`)).status, 404);
  assert.equal((await t.author.get(`/api/chapters/${id}`)).status, 404); // even the author's reader view shows only published text
  assert.equal((await t.author.get(`${A}/${id}`)).data.chapter.content, 'First draft text.');
});

test('validation: duplicate numbers, empty titles, empty publish', async () => {
  assert.equal((await t.author.post(A, { number: 1, title: 'Again' })).status, 409);
  assert.equal((await t.author.post(A, { number: 2, title: '   ' })).status, 400);
  assert.equal((await t.author.post(A, { number: -1, title: 'x' })).status, 400);
  assert.equal((await t.author.post(A, { number: 'abc', title: 'x' })).status, 400);
  const empty = assertStatus(await t.author.post(A, { number: 3, title: 'Empty one' }), 201).data.chapter;
  assert.equal((await t.author.post(`${A}/${empty.id}/publish`, {})).status, 400);
  assert.equal((await t.author.post(`${A}/${empty.id}/publish`, { changeNote: 'x'.repeat(501) })).status, 400);
});

test('publish, small correction, version history and restore', async () => {
  const id = await publishedChapter(t.author, 10, 'The Station (sample)', 'Line one.\n\nLine two has a tpyo.', 'First publish');

  let list = (await t.alice.get('/api/chapters')).data.chapters;
  const row = list.find((c) => c.id === id);
  assert.equal(row.version, 1);
  assert.equal(row.title, 'The Station (sample)');

  // Publishing again with no changes is refused.
  assert.equal((await t.author.post(`${A}/${id}/publish`, {})).status, 400);

  // Save a correction as a DRAFT: reviewers still see version 1.
  assertStatus(await t.author.put(`${A}/${id}`, { content: 'Line one.\n\nLine two has a typo.' }), 200);
  let detail = (await t.author.get(`${A}/${id}`)).data.chapter;
  assert.equal(detail.hasUnpublishedChanges, true);
  assert.match((await t.alice.get(`/api/chapters/${id}`)).data.chapter.content, /tpyo/);

  // Publish the correction: version 2, with a note.
  const pub = assertStatus(await t.author.post(`${A}/${id}/publish`, { changeNote: 'Fixed a typo' }), 200).data.chapter;
  assert.equal(pub.publishedVersion, 2);
  assert.equal(pub.hasUnpublishedChanges, false);
  const seen = (await t.alice.get(`/api/chapters/${id}`)).data.chapter;
  assert.match(seen.content, /typo\./);
  assert.equal(seen.version, 2);
  assert.equal(seen.changeNote, 'Fixed a typo');

  // History keeps both, and the old one is still readable.
  const versions = (await t.author.get(`${A}/${id}/versions`)).data.versions;
  assert.deepEqual(versions.map((v) => [v.version, v.isLive]), [[2, true], [1, false]]);
  const v1 = (await t.author.get(`${A}/${id}/versions/1`)).data.version;
  assert.match(v1.content, /tpyo/);
  assert.equal((await t.author.get(`${A}/${id}/versions/99`)).status, 404);

  // Restore v1 as a draft only.
  assertStatus(await t.author.post(`${A}/${id}/versions/1/restore`, { publish: false }), 200);
  assert.match((await t.author.get(`${A}/${id}`)).data.chapter.content, /tpyo/);
  assert.match((await t.alice.get(`/api/chapters/${id}`)).data.chapter.content, /typo\./); // unchanged for reviewers

  // Restore v1 and publish: becomes NEW version 3; versions 1 and 2 are untouched.
  const restored = assertStatus(await t.author.post(`${A}/${id}/versions/1/restore`, { publish: true }), 200).data.chapter;
  assert.equal(restored.publishedVersion, 3);
  const after = (await t.author.get(`${A}/${id}/versions`)).data.versions;
  assert.equal(after.length, 3);
  assert.equal(after[0].changeNote, 'Restored from version 1');
  assert.match((await t.author.get(`${A}/${id}/versions/2`)).data.version.content, /typo\./);
  assert.match((await t.alice.get(`/api/chapters/${id}`)).data.chapter.content, /tpyo/);
});

test('published versions cannot be edited, even directly in the database', async () => {
  const id = await publishedChapter(t.author, 11, 'Immutable (sample)', 'Original.');
  await assert.rejects(t.db.query("UPDATE chapter_versions SET content = 'tampered' WHERE chapter_id = $1", [id]), /immutable/);
  const v = (await t.author.get(`${A}/${id}/versions/1`)).data.version;
  assert.equal(v.content, 'Original.');
});

test('unpublish hides the chapter and blocks new feedback; re-publish brings it back unchanged', async () => {
  const id = await publishedChapter(t.author, 12, 'Hide me (sample)', 'Some text.');
  assertStatus(await t.alice.post(`/api/chapters/${id}/feedback`, { comment: 'Nice.', category: 'general' }), 201);
  const off = assertStatus(await t.author.post(`${A}/${id}/unpublish`, {}), 200).data.chapter;
  assert.equal(off.status, 'unpublished');
  assert.equal((await t.alice.get(`/api/chapters/${id}`)).status, 404);
  assert.equal((await t.alice.post(`/api/chapters/${id}/feedback`, { comment: 'Still there?' })).status, 404);
  assert.ok(!(await t.alice.get('/api/chapters')).data.chapters.some((c) => c.id === id));
  const on = assertStatus(await t.author.post(`${A}/${id}/publish`, {}), 200).data.chapter;
  assert.equal(on.status, 'published');
  assert.equal(on.publishedVersion, 1); // no pointless new version
  // Feedback survived.
  assert.equal((await t.alice.get(`/api/chapters/${id}/feedback`)).data.feedback.length, 1);
});

test('deleting a chapter removes its versions and feedback', async () => {
  const id = await publishedChapter(t.author, 13, 'Delete me (sample)', 'Bye.');
  assertStatus(await t.alice.post(`/api/chapters/${id}/feedback`, { comment: 'Bye then.' }), 201);
  assertStatus(await t.author.del(`${A}/${id}`), 200);
  assert.equal((await t.author.get(`${A}/${id}`)).status, 404);
  for (const table of ['chapter_versions', 'feedback']) {
    const r = await t.db.query(`SELECT count(*)::int AS n FROM ${table} WHERE chapter_id = $1`, [id]);
    assert.equal(r.rows[0].n, 0, table);
  }
  assert.equal((await t.author.del(`${A}/${id}`)).status, 404);
});

test('chapter list reports status, unread feedback and unpublished changes', async () => {
  const id = await publishedChapter(t.author, 14, 'Listed (sample)', 'Text.');
  assertStatus(await t.alice.post(`/api/chapters/${id}/feedback`, { comment: 'Hello' }), 201);
  assertStatus(await t.author.put(`${A}/${id}`, { content: 'Text, edited.' }), 200);
  const row = (await t.author.get(A)).data.chapters.find((c) => c.id === id);
  assert.equal(row.status, 'published');
  assert.equal(row.hasUnpublishedChanges, true);
  assert.equal(row.unreadFeedback, 1);
  assert.equal(row.publishedVersion, 1);
});

test('reader navigation: previous/next chapter ids', async () => {
  const a = await publishedChapter(t.author, 20, 'Nav A (sample)', 'A');
  const b = await publishedChapter(t.author, 21, 'Nav B (sample)', 'B');
  const detail = (await t.alice.get(`/api/chapters/${a}`)).data.chapter;
  assert.equal(detail.nextId > 0, true);
  const mid = (await t.alice.get(`/api/chapters/${b}`)).data.chapter;
  assert.equal(mid.prevId, a);
});

test('unnumbered chapter (e.g. Prologue) has no required chapter number and navigates correctly', async () => {
  const res = assertStatus(await t.author.post(A, { title: 'Prologue', content: 'In the beginning.' }), 201);
  assert.equal(res.data.chapter.number, null);
  assert.equal(res.data.chapter.title, 'Prologue');

  // Publish it
  assertStatus(await t.author.post(`${A}/${res.data.chapter.id}/publish`, {}), 200);

  // Reviewer can read it
  const readRes = assertStatus(await t.alice.get(`/api/chapters/${res.data.chapter.id}`), 200);
  assert.equal(readRes.data.chapter.number, null);
  assert.equal(readRes.data.chapter.title, 'Prologue');
});

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { S3Storage } from '../src/storage/s3.js';
import { LocalStorage } from '../src/storage/local.js';
import { htmlToChapterText, reflowPdfText } from '../src/services/importer.js';
import { setup, assertStatus, publishedChapter } from './helpers.js';

let t;
before(async () => {
  t = await setup();
});
after(() => t.close());

const A = '/api/author/chapters';

async function makeDocx() {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Chapter 4: Sample Heading')] }),
          new Paragraph({
            children: [new TextRun('He said, '), new TextRun({ text: 'never', italics: true }), new TextRun(' again & again.')],
          }),
          new Paragraph({ children: [new TextRun({ text: 'A bold statement.', bold: true })] }),
          new Paragraph({ children: [new TextRun('* * *')] }),
          new Paragraph({ children: [new TextRun('Final paragraph with a star * inside.')] }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

function makePdf(lines) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    for (const l of lines) doc.text(l);
    doc.end();
  });
}

const formWith = (buffer, name, extra = {}) => {
  const f = new FormData();
  f.append('file', new Blob([buffer]), name);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return f;
};

async function newChapter(number) {
  return assertStatus(await t.author.post(A, { number, title: `Import test ${number} (sample)` }), 201).data.chapter.id;
}

test('docx import: converts formatting, keeps the original file, stays a draft', async () => {
  const id = await newChapter(1);
  const res = assertStatus(await t.author.request('POST', `${A}/${id}/import`, { form: formWith(await makeDocx(), 'ch4.docx') }), 200);
  const c = res.data.chapter;
  assert.match(c.content, /# Chapter 4: Sample Heading/);
  assert.match(c.content, /He said, \*never\* again & again\./);
  assert.match(c.content, /\*\*A bold statement\.\*\*/);
  assert.match(c.content, /^\*\*\*$/m); // scene break
  assert.match(c.content, /star \\\* inside/); // literal asterisk escaped
  assert.ok(res.data.warnings.some((w) => /first line/i.test(w)));
  assert.equal(c.status, 'draft');
  assert.equal(c.files.length, 1);
  assert.equal(c.files[0].type, 'docx');
  assert.equal(res.data.keptFile, true);
  // Reviewers still cannot see it.
  assert.equal((await t.alice.get(`/api/chapters/${id}`)).status, 404);
});

test('retained files: author can download the exact original; reviewers cannot', async () => {
  const id = await newChapter(2);
  const original = await makeDocx();
  const up = assertStatus(await t.author.request('POST', `${A}/${id}/import`, { form: formWith(original, 'my novel (final).docx') }), 200);
  const file = up.data.chapter.files[0];
  const dl = assertStatus(await t.author.get(`/api/author/files/${file.id}/download`), 200);
  assert.ok(dl.buffer.equals(original));
  assert.match(dl.headers.get('content-disposition'), /attachment/);
  assert.equal(dl.headers.get('cache-control'), 'private, no-store');
  assert.equal((await t.alice.get(`/api/author/files/${file.id}/download`)).status, 403);
  assert.equal((await t.client().get(`/api/author/files/${file.id}/download`)).status, 401);
  // Stored under a random server-made name, not the user's file name.
  const key = (await t.db.query('SELECT storage_key FROM chapter_files WHERE id = $1', [file.id])).rows[0].storage_key;
  assert.match(key, /^chapters\/\d+\/[0-9a-f-]{36}\.docx$/);
  // Delete removes the stored bytes.
  assertStatus(await t.author.del(`/api/author/files/${file.id}`), 200);
  await assert.rejects(fs.access(path.join(t.storageDir, key)));
});

test('"don\'t keep a copy" imports the text only', async () => {
  const id = await newChapter(3);
  const res = assertStatus(await t.author.request('POST', `${A}/${id}/import`, { form: formWith(await makeDocx(), 'x.docx', { keepFile: 'false' }) }), 200);
  assert.equal(res.data.chapter.files.length, 0);
  assert.equal(res.data.keptFile, false);
});

test('pdf import extracts text; a PDF can be shared with reviewers only while published', async () => {
  const id = await newChapter(4);
  const pdf = await makePdf(['The first paragraph of the sample PDF chapter.', '', 'The second paragraph is here.']);
  const up = assertStatus(await t.author.request('POST', `${A}/${id}/import`, { form: formWith(pdf, 'ch.pdf') }), 200);
  assert.match(up.data.chapter.content, /first paragraph/);
  assert.match(up.data.chapter.content, /second paragraph/);
  assert.ok(up.data.warnings.some((w) => /PDF/.test(w)));
  const file = up.data.chapter.files[0];

  // Not shared yet.
  assert.equal(file.sharedWithReviewers, false);
  assertStatus(await t.author.post(`${A}/${id}/publish`, {}), 200);
  assert.equal((await t.alice.get(`/api/chapters/${id}`)).data.chapter.pdf, null);
  assert.equal((await t.alice.get(`/api/chapters/${id}/pdf`)).status, 404);

  // Share it.
  assertStatus(await t.author.patch(`/api/author/files/${file.id}`, { sharedWithReviewers: true }), 200);
  const view = (await t.alice.get(`/api/chapters/${id}`)).data.chapter;
  assert.ok(view.pdf);
  const got = assertStatus(await t.alice.get(view.pdf.url), 200);
  assert.ok(got.buffer.equals(pdf));
  assert.equal(got.headers.get('content-type'), 'application/pdf');
  assert.equal((await t.client().get(view.pdf.url)).status, 401);

  // Unpublish: the PDF becomes unavailable too.
  assertStatus(await t.author.post(`${A}/${id}/unpublish`, {}), 200);
  assert.equal((await t.alice.get(`/api/chapters/${id}/pdf`)).status, 404);
});

test('only PDFs can be shared with reviewers (Word files are author-only)', async () => {
  const id = await newChapter(5);
  const up = assertStatus(await t.author.request('POST', `${A}/${id}/import`, { form: formWith(await makeDocx(), 'a.docx') }), 200);
  assert.equal((await t.author.patch(`/api/author/files/${up.data.chapter.files[0].id}`, { sharedWithReviewers: true })).status, 400);
});

test('upload validation: wrong type, fake files, old .doc, oversize, missing file', async () => {
  const id = await newChapter(6);
  const post = (form) => t.author.request('POST', `${A}/${id}/import`, { form });
  assert.equal((await post(formWith(Buffer.from('hello'), 'notes.txt'))).status, 415);
  assert.equal((await post(formWith(Buffer.from('hello world'), 'fake.docx'))).status, 415);
  assert.equal((await post(formWith(Buffer.from('hello world'), 'fake.pdf'))).status, 415);
  assert.equal((await post(formWith(Buffer.from('PK\u0003\u0004 not really a zip'), 'broken.docx'))).status, 422);
  assert.equal((await post(formWith(Buffer.from('%PDF-1.4 garbage'), 'broken.pdf'))).status, 422);
  assert.equal((await post(formWith(Buffer.from('x'), 'old.doc'))).status, 415);
  assert.equal((await post(formWith(Buffer.alloc(2 * 1024 * 1024, 1), 'big.pdf'))).status, 413); // limit is 1 MB in tests
  assert.equal((await post(new FormData())).status, 400);
  assert.equal((await t.author.get(`${A}/${id}`)).data.chapter.files.length, 0); // nothing was stored
});

test('text-free PDFs give a helpful error', async () => {
  const id = await newChapter(7);
  const doc = await new Promise((resolve) => {
    const d = new PDFDocument();
    const chunks = [];
    d.on('data', (c) => chunks.push(c));
    d.on('end', () => resolve(Buffer.concat(chunks)));
    d.rect(10, 10, 100, 100).fill('#000');
    d.end();
  });
  const res = await t.author.request('POST', `${A}/${id}/import`, { form: formWith(doc, 'scan.pdf') });
  assert.equal(res.status, 422);
  assert.match(res.data.error, /could not be read|No text/);
});

test('deleting a chapter also deletes its stored files', async () => {
  const id = await newChapter(8);
  const up = assertStatus(await t.author.request('POST', `${A}/${id}/import`, { form: formWith(await makeDocx(), 'a.docx') }), 200);
  const key = (await t.db.query('SELECT storage_key FROM chapter_files WHERE id = $1', [up.data.chapter.files[0].id])).rows[0].storage_key;
  await fs.access(path.join(t.storageDir, key));
  assertStatus(await t.author.del(`${A}/${id}`), 200);
  await assert.rejects(fs.access(path.join(t.storageDir, key)));
});

test('re-importing replaces the working text but never touches published versions', async () => {
  const id = await publishedChapter(t.author, 30, 'Replace me (sample)', 'Original published text.');
  assertStatus(await t.author.request('POST', `${A}/${id}/import`, { form: formWith(await makeDocx(), 'new.docx') }), 200);
  assert.match((await t.alice.get(`/api/chapters/${id}`)).data.chapter.content, /Original published text/);
  assert.match((await t.author.get(`${A}/${id}`)).data.chapter.content, /He said/);
  assert.equal((await t.author.get(`${A}/${id}`)).data.chapter.hasUnpublishedChanges, true);
});

test('the importer functions behave on tricky input', () => {
  assert.equal(htmlToChapterText('<p>Hello <em>there </em>world</p>'), 'Hello *there* world');
  assert.equal(htmlToChapterText('<p>Tom &amp; Jerry</p><p></p><p>Next</p>'), 'Tom & Jerry\n\nNext');
  const full = 'This line is as wide as the page margin allows it to be so it is long';
  const flowed = reflowPdfText([full, full, 'and this is the short last line.', full, full, 'Another short end.'].join('\n'));
  assert.ok(flowed.includes('\n\n'));
  assert.equal(flowed.split('\n\n').length, 2);
  assert.ok(flowed.includes('so it is long This line is as wide'));
});

test('storage providers: local rejects unsafe keys; S3 provider sends the right commands', async () => {
  const local = new LocalStorage(t.storageDir);
  await assert.rejects(local.put('../escape.txt', Buffer.from('x')));
  await assert.rejects(local.put('/etc/passwd', Buffer.from('x')));
  await local.put('a/b.txt', Buffer.from('ok'));
  assert.equal((await local.get('a/b.txt')).toString(), 'ok');
  await local.delete('a/b.txt');
  await local.delete('a/b.txt'); // deleting twice is fine

  const sent = [];
  const fake = {
    send: async (cmd) => {
      sent.push([cmd.constructor.name, cmd.input]);
      return { Body: { transformToByteArray: async () => new Uint8Array([104, 105]) } };
    },
  };
  const s3 = new S3Storage({ bucket: 'b' }, fake);
  await s3.put('k1', Buffer.from('hi'), 'application/pdf');
  assert.equal((await s3.get('k1')).toString(), 'hi');
  await s3.delete('k1');
  assert.deepEqual(sent.map((s) => s[0]), ['PutObjectCommand', 'GetObjectCommand', 'DeleteObjectCommand']);
  assert.equal(sent[0][1].Bucket, 'b');
  assert.equal(sent[0][1].ContentType, 'application/pdf');
});

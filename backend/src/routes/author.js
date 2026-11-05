import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { requireAuthor } from '../middleware/auth.js';
import { HttpError, bad, notFound, parseId, text, integer, countWords } from '../http.js';
import { detectFileType, cleanFileName, extractChapterText } from '../services/importer.js';

const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/;

const statusOf = (r) => (r.is_published ? 'published' : r.published_version ? 'unpublished' : 'draft');

const chapterListRow = (r) => ({
  id: r.id,
  number: r.number,
  sortOrder: r.sort_order,
  title: r.title,
  status: statusOf(r),
  publishedVersion: r.published_version,
  lastPublishedAt: r.last_published_at,
  hasUnpublishedChanges: !!r.published_version && (r.title !== r.published_title || r.content_differs),
  updatedAt: r.updated_at,
  wordCount: r.word_count,
  unreadFeedback: r.unread_feedback,
  feedbackCount: r.feedback_count,
});

const LIST_SQL = `
  SELECT c.id, c.chapter_number AS number, c.sort_order, c.title, c.is_published, c.published_version, c.updated_at,
         v.created_at AS last_published_at, v.title AS published_title,
         (v.content IS DISTINCT FROM c.content) AS content_differs,
         CASE WHEN btrim(c.content) = '' THEN 0
              ELSE cardinality(regexp_split_to_array(btrim(c.content), '\\s+')) END AS word_count,
         (SELECT count(*)::int FROM feedback f WHERE f.chapter_id = c.id AND NOT f.is_read) AS unread_feedback,
         (SELECT count(*)::int FROM feedback f WHERE f.chapter_id = c.id) AS feedback_count
    FROM chapters c
    LEFT JOIN chapter_versions v ON v.chapter_id = c.id AND v.version_number = c.published_version`;

const fileRow = (f) => ({
  id: f.id,
  name: f.original_name,
  type: f.file_type,
  sizeBytes: f.size_bytes,
  sharedWithReviewers: f.shared_with_reviewers,
  uploadedAt: f.uploaded_at,
});

export function authorRoutes({ config, db, storage }) {
  const r = Router();
  r.use(requireAuthor);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1, fields: 5 },
  });

  async function loadChapter(q, id) {
    const { rows } = await q.query(
      `SELECT c.*, v.created_at AS last_published_at, v.title AS published_title, v.content AS published_content
         FROM chapters c
         LEFT JOIN chapter_versions v ON v.chapter_id = c.id AND v.version_number = c.published_version
        WHERE c.id = $1`,
      [id],
    );
    if (!rows[0]) throw notFound('Chapter not found.');
    return rows[0];
  }

  async function chapterDetail(q, id) {
    const c = await loadChapter(q, id);
    const files = await q.query('SELECT * FROM chapter_files WHERE chapter_id = $1 ORDER BY uploaded_at DESC, id DESC', [id]);
    return {
      id: c.id,
      number: c.chapter_number,
      sortOrder: c.sort_order,
      title: c.title,
      content: c.content,
      status: statusOf(c),
      publishedVersion: c.published_version,
      lastPublishedAt: c.last_published_at,
      hasUnpublishedChanges: !!c.published_version && (c.title !== c.published_title || c.content !== c.published_content),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      wordCount: countWords(c.content),
      files: files.rows.map(fileRow),
    };
  }

  function chapterFields(body, { partial }) {
    return {
      number: integer(body?.number, { name: 'Chapter number', min: 0, max: 9999, required: false }),
      title: text(body?.title, { name: 'Title', required: !partial, max: 200 }),
      content: text(body?.content, { name: 'Chapter text', max: 1_000_000, trim: false }),
    };
  }

  const duplicateNumber = (err, number) =>
    err.code === '23505' && number != null ? new HttpError(409, `Chapter ${number} already exists. Choose a different number.`) : err;

  // ---------- Chapters ----------
  r.get('/chapters', async (_req, res) => {
    const { rows } = await db.query(`${LIST_SQL} ORDER BY c.sort_order ASC, c.chapter_number ASC NULLS LAST, c.id ASC`);
    res.json({ chapters: rows.map(chapterListRow) });
  });

  r.post('/chapters', async (req, res) => {
    const f = chapterFields(req.body, { partial: false });
    const num = (req.body?.number === '' || req.body?.number === null || req.body?.number === undefined)
      ? null
      : integer(req.body.number, { name: 'Chapter number', min: 0, max: 9999, required: false });

    let sortOrder = req.body?.sortOrder !== undefined
      ? integer(req.body.sortOrder, { name: 'Sort order', min: -9999, max: 999999 })
      : undefined;

    if (sortOrder === undefined) {
      if (num !== null && num !== undefined) {
        sortOrder = num;
      } else {
        const lowerTitle = (f.title || '').toLowerCase();
        if (lowerTitle.includes('prologue') || lowerTitle.includes('intro') || lowerTitle.includes('preface')) {
          sortOrder = 0;
        } else {
          const maxQ = await db.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM chapters');
          sortOrder = maxQ.rows[0].next_order;
        }
      }
    }

    try {
      const { rows } = await db.query(
        'INSERT INTO chapters (chapter_number, sort_order, title, content) VALUES ($1, $2, $3, $4) RETURNING id',
        [num, sortOrder, f.title, f.content ?? ''],
      );
      res.status(201).json({ chapter: await chapterDetail(db, rows[0].id) });
    } catch (err) {
      throw duplicateNumber(err, num);
    }
  });

  r.get('/chapters/:id', async (req, res) => {
    res.json({ chapter: await chapterDetail(db, parseId(req.params.id)) });
  });

  // Save draft. This NEVER changes what reviewers see.
  r.put('/chapters/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const f = chapterFields(req.body, { partial: true });
    const hasNumber = req.body !== null && typeof req.body === 'object' && 'number' in req.body;
    const numVal = hasNumber && (req.body.number === '' || req.body.number === null)
      ? null
      : hasNumber
        ? integer(req.body.number, { name: 'Chapter number', min: 0, max: 9999, required: false })
        : null;
    const hasTitle = req.body !== null && typeof req.body === 'object' && 'title' in req.body;
    const hasContent = req.body !== null && typeof req.body === 'object' && 'content' in req.body;
    const hasSortOrder = req.body !== null && typeof req.body === 'object' && 'sortOrder' in req.body;
    const sortOrderVal = hasSortOrder ? integer(req.body.sortOrder, { name: 'Sort order', min: -9999, max: 999999 }) : undefined;

    try {
      const upd = await db.query(
        `UPDATE chapters
            SET chapter_number = CASE WHEN $2::boolean THEN $3::integer ELSE chapter_number END,
                title = CASE WHEN $4::boolean THEN $5::text ELSE title END,
                content = CASE WHEN $6::boolean THEN $7::text ELSE content END,
                sort_order = CASE WHEN $8::boolean THEN $9::integer ELSE sort_order END,
                updated_at = now()
          WHERE id = $1 RETURNING id`,
        [
          id,
          hasNumber, numVal,
          hasTitle, f.title ?? null,
          hasContent, f.content ?? null,
          hasSortOrder, sortOrderVal ?? 0,
        ],
      );
      if (!upd.rows[0]) throw notFound('Chapter not found.');
    } catch (err) {
      throw duplicateNumber(err, numVal);
    }
    res.json({ chapter: await chapterDetail(db, id) });
  });

  // Publish the working copy as a new permanent version.
  r.post('/chapters/:id/publish', async (req, res) => {
    const id = parseId(req.params.id);
    const note = text(req.body?.changeNote, { name: 'Change note', max: 500 }) ?? '';
    const detail = await db.tx(async (t) => {
      const lock = await t.query('SELECT * FROM chapters WHERE id = $1 FOR UPDATE', [id]);
      const c = lock.rows[0];
      if (!c) throw notFound('Chapter not found.');
      if (!c.content.trim()) throw bad('This chapter has no text yet. Add some text before publishing.');
      const cur = c.published_version
        ? (await t.query('SELECT title, content FROM chapter_versions WHERE chapter_id = $1 AND version_number = $2', [id, c.published_version])).rows[0]
        : null;
      const same = cur && cur.title === c.title && cur.content === c.content;
      if (same && c.is_published) throw bad('Nothing has changed since the published version, so there is nothing to publish.');
      if (same) {
        // Re-publishing an unchanged chapter just switches it back on.
        await t.query('UPDATE chapters SET is_published = true, updated_at = now() WHERE id = $1', [id]);
      } else {
        const next = (await t.query('SELECT COALESCE(max(version_number), 0) + 1 AS n FROM chapter_versions WHERE chapter_id = $1', [id])).rows[0].n;
        await t.query(
          `INSERT INTO chapter_versions (chapter_id, version_number, title, content, word_count, change_note, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, next, c.title, c.content, countWords(c.content), note, req.user.id],
        );
        await t.query('UPDATE chapters SET is_published = true, published_version = $2, updated_at = now() WHERE id = $1', [id, next]);
      }
      return chapterDetail(t, id);
    });
    res.json({ chapter: detail });
  });

  r.post('/chapters/:id/unpublish', async (req, res) => {
    const id = parseId(req.params.id);
    const upd = await db.query('UPDATE chapters SET is_published = false, updated_at = now() WHERE id = $1 RETURNING id', [id]);
    if (!upd.rows[0]) throw notFound('Chapter not found.');
    res.json({ chapter: await chapterDetail(db, id) });
  });

  r.delete('/chapters/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const files = await db.query('SELECT storage_key FROM chapter_files WHERE chapter_id = $1', [id]);
    const del = await db.query('DELETE FROM chapters WHERE id = $1', [id]); // versions, files and feedback go with it
    if (del.rowCount === 0) throw notFound('Chapter not found.');
    for (const f of files.rows) {
      try {
        await storage.delete(f.storage_key);
      } catch (err) {
        console.error('[storage] could not delete', f.storage_key, err.message);
      }
    }
    res.json({ ok: true });
  });

  // ---------- Version history ----------
  r.get('/chapters/:id/versions', async (req, res) => {
    const id = parseId(req.params.id);
    const c = await loadChapter(db, id);
    const { rows } = await db.query(
      `SELECT v.version_number, v.title, v.word_count, v.change_note, v.created_at, u.display_name AS by_name
         FROM chapter_versions v LEFT JOIN users u ON u.id = v.created_by
        WHERE v.chapter_id = $1 ORDER BY v.version_number DESC`,
      [id],
    );
    res.json({
      versions: rows.map((v) => ({
        version: v.version_number,
        title: v.title,
        wordCount: v.word_count,
        changeNote: v.change_note,
        createdAt: v.created_at,
        isLive: c.is_published && c.published_version === v.version_number,
      })),
    });
  });

  r.get('/chapters/:id/versions/:n', async (req, res) => {
    const id = parseId(req.params.id);
    const n = parseId(req.params.n);
    const { rows } = await db.query(
      'SELECT version_number, title, content, change_note, created_at FROM chapter_versions WHERE chapter_id = $1 AND version_number = $2',
      [id, n],
    );
    if (!rows[0]) throw notFound('Version not found.');
    const v = rows[0];
    res.json({ version: { version: v.version_number, title: v.title, content: v.content, changeNote: v.change_note, createdAt: v.created_at } });
  });

  // Restore: copies an old version into the working copy. With publish=true it is also
  // published right away as a NEW version (the old versions are never altered).
  r.post('/chapters/:id/versions/:n/restore', async (req, res) => {
    const id = parseId(req.params.id);
    const n = parseId(req.params.n);
    const publish = req.body?.publish === true;
    const noteText = text(req.body?.changeNote, { name: 'Change note', max: 500 });
    const detail = await db.tx(async (t) => {
      const lock = await t.query('SELECT id FROM chapters WHERE id = $1 FOR UPDATE', [id]);
      if (!lock.rows[0]) throw notFound('Chapter not found.');
      const old = (await t.query('SELECT title, content FROM chapter_versions WHERE chapter_id = $1 AND version_number = $2', [id, n])).rows[0];
      if (!old) throw notFound('Version not found.');
      await t.query('UPDATE chapters SET title = $2, content = $3, updated_at = now() WHERE id = $1', [id, old.title, old.content]);
      if (publish) {
        const next = (await t.query('SELECT max(version_number) + 1 AS n FROM chapter_versions WHERE chapter_id = $1', [id])).rows[0].n;
        await t.query(
          `INSERT INTO chapter_versions (chapter_id, version_number, title, content, word_count, change_note, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, next, old.title, old.content, countWords(old.content), noteText || `Restored from version ${n}`, req.user.id],
        );
        await t.query('UPDATE chapters SET is_published = true, published_version = $2 WHERE id = $1', [id, next]);
      }
      return chapterDetail(t, id);
    });
    res.json({ chapter: detail });
  });

  // ---------- Import a .docx / .pdf into the working copy ----------
  r.post('/chapters/:id/import', upload.single('file'), async (req, res) => {
    const id = parseId(req.params.id);
    if (!req.file) throw bad('Choose a .docx or .pdf file to upload.');
    await loadChapter(db, id);
    const fileType = detectFileType(req.file);
    const { text: imported, warnings } = await extractChapterText(req.file.buffer, fileType);
    const keep = String(req.body?.keepFile ?? 'true') !== 'false';

    let storageKey = null;
    if (keep) {
      storageKey = `chapters/${id}/${crypto.randomUUID()}.${fileType}`;
      await storage.put(storageKey, req.file.buffer, MIME[fileType]);
    }
    try {
      await db.tx(async (t) => {
        const upd = await t.query('UPDATE chapters SET content = $2, updated_at = now() WHERE id = $1 RETURNING id', [id, imported]);
        if (!upd.rows[0]) throw notFound('Chapter not found.');
        if (keep) {
          await t.query(
            `INSERT INTO chapter_files (chapter_id, original_name, file_type, size_bytes, sha256, storage_key, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              cleanFileName(req.file.originalname),
              fileType,
              req.file.size,
              crypto.createHash('sha256').update(req.file.buffer).digest('hex'),
              storageKey,
              req.user.id,
            ],
          );
        }
      });
    } catch (err) {
      if (storageKey) await storage.delete(storageKey).catch(() => {});
      throw err;
    }
    res.json({ chapter: await chapterDetail(db, id), warnings, keptFile: keep });
  });

  // ---------- Retained files ----------
  async function loadFile(id) {
    const { rows } = await db.query('SELECT * FROM chapter_files WHERE id = $1', [id]);
    if (!rows[0]) throw notFound('File not found.');
    return rows[0];
  }

  r.get('/files/:id/download', async (req, res) => {
    const f = await loadFile(parseId(req.params.id));
    const data = await storage.get(f.storage_key);
    res.set('Content-Type', MIME[f.file_type]);
    res.set('Cache-Control', 'private, no-store');
    res.attachment(f.original_name);
    res.send(data);
  });

  r.patch('/files/:id', async (req, res) => {
    const f = await loadFile(parseId(req.params.id));
    if (typeof req.body?.sharedWithReviewers !== 'boolean') throw bad('sharedWithReviewers must be true or false.');
    if (req.body.sharedWithReviewers && f.file_type !== 'pdf') throw bad('Only PDF files can be shared with reviewers.');
    const { rows } = await db.query('UPDATE chapter_files SET shared_with_reviewers = $2 WHERE id = $1 RETURNING *', [
      f.id,
      req.body.sharedWithReviewers,
    ]);
    res.json({ file: fileRow(rows[0]) });
  });

  r.delete('/files/:id', async (req, res) => {
    const f = await loadFile(parseId(req.params.id));
    await db.query('DELETE FROM chapter_files WHERE id = $1', [f.id]);
    try {
      await storage.delete(f.storage_key);
    } catch (err) {
      console.error('[storage] could not delete', f.storage_key, err.message);
    }
    res.json({ ok: true });
  });

  // ---------- Feedback inbox ----------
  r.get('/feedback', async (req, res) => {
    const chapterId = req.query.chapterId ? parseId(req.query.chapterId) : null;
    const reviewerId = req.query.reviewerId ? parseId(req.query.reviewerId) : null;
    const unreadOnly = req.query.unread === 'true';
    const order = req.query.order === 'newest' ? 'DESC' : 'ASC';
    const { rows } = await db.query(
      `SELECT f.id, f.chapter_id, c.chapter_number, COALESCE(v.title, c.title) AS chapter_title,
              f.category, f.comment, f.version_number, f.is_read, f.created_at, f.updated_at,
              u.id AS reviewer_id, u.display_name, u.email,
              (c.is_published AND c.published_version > f.version_number) AS chapter_updated_since
         FROM feedback f
         JOIN chapters c ON c.id = f.chapter_id
         JOIN users u ON u.id = f.user_id
         LEFT JOIN chapter_versions v ON v.chapter_id = c.id AND v.version_number = c.published_version
        WHERE ($1::int IS NULL OR f.chapter_id = $1)
          AND ($2::int IS NULL OR f.user_id = $2)
          AND (NOT $3::boolean OR NOT f.is_read)
        ORDER BY f.created_at ${order}, f.id ${order}
        LIMIT 1000`,
      [chapterId, reviewerId, unreadOnly],
    );
    res.json({
      feedback: rows.map((f) => ({
        id: f.id,
        chapterId: f.chapter_id,
        chapterNumber: f.chapter_number,
        chapterTitle: f.chapter_title,
        category: f.category,
        comment: f.comment,
        version: f.version_number,
        isRead: f.is_read,
        createdAt: f.created_at,
        edited: f.updated_at.getTime() - f.created_at.getTime() > 1000,
        chapterUpdatedSince: f.chapter_updated_since === true,
        reviewer: { id: f.reviewer_id, name: f.display_name, email: f.email },
      })),
    });
  });

  r.patch('/feedback/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (typeof req.body?.isRead !== 'boolean') throw bad('isRead must be true or false.');
    const upd = await db.query('UPDATE feedback SET is_read = $2 WHERE id = $1 RETURNING id, is_read', [id, req.body.isRead]);
    if (!upd.rows[0]) throw notFound('Feedback not found.');
    res.json({ id, isRead: upd.rows[0].is_read });
  });

  r.post('/feedback/mark-read', async (req, res) => {
    const chapterId = req.body?.chapterId ? parseId(req.body.chapterId) : null;
    const upd = await db.query('UPDATE feedback SET is_read = true WHERE NOT is_read AND ($1::int IS NULL OR chapter_id = $1)', [chapterId]);
    res.json({ updated: upd.rowCount });
  });

  // ---------- Reviewer access ----------
  const reviewerRow = (a) => ({
    id: a.id,
    email: a.email,
    note: a.note,
    invitedAt: a.invited_at,
    revoked: !!a.revoked_at,
    revokedAt: a.revoked_at,
    userId: a.user_id,
    name: a.display_name || '',
    lastLoginAt: a.last_login_at,
    feedbackCount: a.feedback_count,
  });

  const REVIEWERS_SQL = `
    SELECT ra.*, u.display_name, u.last_login_at,
           (SELECT count(*)::int FROM feedback f WHERE f.user_id = ra.user_id) AS feedback_count
      FROM reviewer_access ra LEFT JOIN users u ON u.id = ra.user_id`;

  r.get('/reviewers', async (_req, res) => {
    const { rows } = await db.query(`${REVIEWERS_SQL} ORDER BY ra.invited_at, ra.id`);
    res.json({ reviewers: rows.map(reviewerRow) });
  });

  r.post('/reviewers', async (req, res) => {
    const raw = Array.isArray(req.body?.emails) ? req.body.emails.join(' ') : req.body?.emails;
    const input = text(raw, { name: 'Email addresses', required: true, max: 5000 });
    const note = text(req.body?.note, { name: 'Note', max: 200 }) ?? '';
    const emails = [...new Set(input.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (emails.length > 50) throw bad('Add at most 50 addresses at a time.');
    const invalid = emails.filter((e) => !EMAIL_RE.test(e) || e.length > 254);
    if (invalid.length) throw bad(`These do not look like email addresses: ${invalid.slice(0, 5).join(', ')}`);
    const skipped = emails.filter((e) => config.authorEmails.includes(e));
    const toAdd = emails.filter((e) => !skipped.includes(e));
    for (const email of toAdd) {
      await db.query(
        `INSERT INTO reviewer_access (email, note) VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET revoked_at = NULL, note = CASE WHEN $2 <> '' THEN $2 ELSE reviewer_access.note END`,
        [email, note],
      );
    }
    const { rows } = await db.query(`${REVIEWERS_SQL} ORDER BY ra.invited_at, ra.id`);
    res.status(201).json({ added: toAdd.length, skippedAuthor: skipped, reviewers: rows.map(reviewerRow) });
  });

  r.patch('/reviewers/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const sets = [];
    const params = [id];
    if (req.body?.revoked !== undefined) {
      if (typeof req.body.revoked !== 'boolean') throw bad('revoked must be true or false.');
      sets.push(req.body.revoked ? 'revoked_at = now()' : 'revoked_at = NULL');
    }
    if (req.body?.note !== undefined) {
      params.push(text(req.body.note, { name: 'Note', max: 200 }) ?? '');
      sets.push(`note = $${params.length}`);
    }
    if (sets.length === 0) throw bad('Nothing to update.');
    const upd = await db.query(`UPDATE reviewer_access SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, params);
    if (!upd.rows[0]) throw notFound('Reviewer not found.');
    const { rows } = await db.query(`${REVIEWERS_SQL} WHERE ra.id = $1`, [id]);
    res.json({ reviewer: reviewerRow(rows[0]) });
  });

  r.delete('/reviewers/:id', async (req, res) => {
    const del = await db.query('DELETE FROM reviewer_access WHERE id = $1', [parseId(req.params.id)]);
    if (del.rowCount === 0) throw notFound('Reviewer not found.');
    res.json({ ok: true });
  });

  // ---------- Book details ----------
  r.put('/book', async (req, res) => {
    const b = req.body || {};
    const title = text(b.title, { name: 'Title', required: true, max: 200 });
    const authorName = text(b.authorName, { name: 'Author name', max: 200 }) ?? '';
    const tagline = text(b.tagline, { name: 'Tagline', max: 300 }) ?? '';
    const synopsis = text(b.synopsis, { name: 'Synopsis', max: 5000 }) ?? '';
    const reviewerNote = text(b.reviewerNote, { name: 'Note to reviewers', max: 5000 }) ?? '';
    await db.query(
      `UPDATE book_details SET title = $1, author_name = $2, tagline = $3, synopsis = $4, reviewer_note = $5, updated_at = now() WHERE id = 1`,
      [title, authorName, tagline, synopsis, reviewerNote],
    );
    res.json({ title, authorName, tagline, synopsis, reviewerNote });
  });

  return r;
}

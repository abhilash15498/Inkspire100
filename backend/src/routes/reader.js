import { Router } from 'express';
import { requireUser } from '../middleware/auth.js';
import { HttpError, notFound, parseId, text, CATEGORIES } from '../http.js';

const PUBLISHED_JOIN = `chapter_versions v ON v.chapter_id = c.id AND v.version_number = c.published_version`;

const chapterSummary = (r) => ({
  id: r.id,
  number: r.number,
  title: r.title,
  version: r.version,
  updatedAt: r.updated_at,
  changeNote: r.change_note,
  wordCount: r.word_count,
  myFeedbackCount: r.my_feedback_count,
  updatedSinceMyFeedback: r.my_last_feedback_version !== null && r.my_last_feedback_version < r.version,
});

const feedbackRow = (r) => ({
  id: r.id,
  chapterId: r.chapter_id,
  chapterNumber: r.chapter_number,
  chapterTitle: r.chapter_title,
  category: r.category,
  comment: r.comment,
  version: r.version_number,
  currentVersion: r.current_version,
  chapterUpdatedSince: r.current_version !== null && r.current_version > r.version_number,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  edited: r.updated_at.getTime() - r.created_at.getTime() > 1000,
});

const MY_FEEDBACK_SQL = `
  SELECT f.id, f.chapter_id, c.chapter_number, COALESCE(v.title, c.title) AS chapter_title,
         f.category, f.comment, f.version_number, f.created_at, f.updated_at,
         CASE WHEN c.is_published THEN c.published_version END AS current_version
    FROM feedback f
    JOIN chapters c ON c.id = f.chapter_id
    LEFT JOIN ${PUBLISHED_JOIN}
   WHERE f.user_id = $1`;

/** Everything a signed-in person (author or reviewer) can read. Drafts are never included. */
export function readerRoutes({ db, storage }) {
  const r = Router();
  r.use(requireUser);

  r.get('/book', async (_req, res) => {
    const { rows } = await db.query('SELECT * FROM book_details WHERE id = 1');
    const b = rows[0];
    res.json({
      title: b.title,
      authorName: b.author_name,
      tagline: b.tagline,
      synopsis: b.synopsis,
      reviewerNote: b.reviewer_note,
    });
  });

  r.get('/chapters', async (req, res) => {
    const { rows } = await db.query(
      `SELECT c.id, c.chapter_number AS number, v.title, v.version_number AS version,
              v.created_at AS updated_at, v.change_note, v.word_count,
              (SELECT count(*)::int FROM feedback f WHERE f.chapter_id = c.id AND f.user_id = $1) AS my_feedback_count,
              (SELECT max(f.version_number) FROM feedback f WHERE f.chapter_id = c.id AND f.user_id = $1) AS my_last_feedback_version
         FROM chapters c JOIN ${PUBLISHED_JOIN}
        WHERE c.is_published
        ORDER BY c.sort_order ASC, c.chapter_number ASC NULLS LAST, c.id ASC`,
      [req.user.id],
    );
    res.json({ chapters: rows.map(chapterSummary) });
  });

  r.get('/chapters/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await db.query(
      `SELECT c.id, c.chapter_number AS number, v.title, v.content, v.version_number AS version,
              v.created_at AS updated_at, v.change_note, v.word_count,
              (SELECT count(*)::int FROM feedback f WHERE f.chapter_id = c.id AND f.user_id = $2) AS my_feedback_count,
              (SELECT max(f.version_number) FROM feedback f WHERE f.chapter_id = c.id AND f.user_id = $2) AS my_last_feedback_version
         FROM chapters c JOIN ${PUBLISHED_JOIN}
        WHERE c.id = $1 AND c.is_published`,
      [id, req.user.id],
    );
    if (!rows[0]) throw notFound('This chapter is not available.');
    const c = rows[0];
    const [adjacent, pdf] = await Promise.all([
      db.query(
        `WITH ordered AS (
           SELECT id,
                  LAG(id) OVER (ORDER BY sort_order ASC, chapter_number ASC NULLS LAST, id ASC) AS prev_id,
                  LEAD(id) OVER (ORDER BY sort_order ASC, chapter_number ASC NULLS LAST, id ASC) AS next_id
             FROM chapters
            WHERE is_published
         )
         SELECT prev_id, next_id FROM ordered WHERE id = $1`,
        [id],
      ),
      db.query(
        `SELECT id, original_name, size_bytes FROM chapter_files
          WHERE chapter_id = $1 AND shared_with_reviewers ORDER BY uploaded_at DESC LIMIT 1`,
        [id],
      ),
    ]);
    res.json({
      chapter: {
        ...chapterSummary(c),
        content: c.content,
        prevId: adjacent.rows[0]?.prev_id ?? null,
        nextId: adjacent.rows[0]?.next_id ?? null,
        pdf: pdf.rows[0]
          ? { name: pdf.rows[0].original_name, sizeBytes: pdf.rows[0].size_bytes, url: `/api/chapters/${id}/pdf` }
          : null,
      },
    });
  });

  // A PDF the author chose to share, for a chapter that is currently published.
  r.get('/chapters/:id/pdf', async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await db.query(
      `SELECT f.storage_key, f.original_name
         FROM chapter_files f JOIN chapters c ON c.id = f.chapter_id
        WHERE f.chapter_id = $1 AND f.shared_with_reviewers AND f.file_type = 'pdf' AND c.is_published
        ORDER BY f.uploaded_at DESC LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw notFound('No PDF is available for this chapter.');
    const data = await storage.get(rows[0].storage_key);
    res.set('Content-Type', 'application/pdf');
    res.set('Cache-Control', 'private, no-store');
    res.set('Content-Disposition', `inline; filename="chapter-${id}.pdf"`);
    res.send(data);
  });

  // ----- Feedback: a person only ever sees and edits their own -----
  r.get('/chapters/:id/feedback', async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = await db.query(`${MY_FEEDBACK_SQL} AND f.chapter_id = $2 ORDER BY f.created_at DESC, f.id DESC`, [
      req.user.id,
      id,
    ]);
    res.json({ feedback: rows.map(feedbackRow) });
  });

  r.get('/me/feedback', async (req, res) => {
    const { rows } = await db.query(`${MY_FEEDBACK_SQL} ORDER BY f.created_at DESC, f.id DESC`, [req.user.id]);
    res.json({ feedback: rows.map(feedbackRow) });
  });

  function readFeedbackBody(body, { partial = false } = {}) {
    const comment = text(body?.comment, { name: 'Comment', required: !partial, max: 5000 });
    const category = body?.category === undefined && partial ? undefined : String(body?.category ?? 'general');
    if (category !== undefined && !CATEGORIES.includes(category)) {
      throw new HttpError(400, `Category must be one of: ${CATEGORIES.join(', ')}.`);
    }
    return { comment, category };
  }

  r.post('/chapters/:id/feedback', async (req, res) => {
    const id = parseId(req.params.id);
    const { comment, category } = readFeedbackBody(req.body);
    const ch = await db.query('SELECT published_version FROM chapters WHERE id = $1 AND is_published', [id]);
    if (!ch.rows[0]) throw notFound('This chapter is not available.');
    const ins = await db.query(
      `INSERT INTO feedback (chapter_id, user_id, version_number, category, comment)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [id, req.user.id, ch.rows[0].published_version, category, comment],
    );
    const { rows } = await db.query(`${MY_FEEDBACK_SQL} AND f.id = $2`, [req.user.id, ins.rows[0].id]);
    res.status(201).json({ feedback: feedbackRow(rows[0]) });
  });

  r.put('/feedback/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const { comment, category } = readFeedbackBody(req.body, { partial: true });
    // "AND user_id = $1" is what stops anyone editing somebody else's feedback.
    const upd = await db.query(
      `UPDATE feedback
          SET comment = COALESCE($3, comment), category = COALESCE($4, category),
              is_read = false, updated_at = now()
        WHERE id = $2 AND user_id = $1 RETURNING id`,
      [req.user.id, id, comment ?? null, category ?? null],
    );
    if (!upd.rows[0]) throw notFound('Feedback not found.');
    const { rows } = await db.query(`${MY_FEEDBACK_SQL} AND f.id = $2`, [req.user.id, id]);
    res.json({ feedback: feedbackRow(rows[0]) });
  });

  r.delete('/feedback/:id', async (req, res) => {
    const id = parseId(req.params.id);
    const del = await db.query('DELETE FROM feedback WHERE id = $2 AND user_id = $1', [req.user.id, id]);
    if (del.rowCount === 0) throw notFound('Feedback not found.');
    res.json({ ok: true });
  });

  return r;
}

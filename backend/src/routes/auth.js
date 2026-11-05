import { Router } from 'express';
import { HttpError, text } from '../http.js';
import { issueSession, clearSession } from '../middleware/auth.js';

export function authRoutes({ config, db, verifyGoogle }) {
  const r = Router();

  // Public: what the login page needs.
  r.get('/config', async (_req, res) => {
    const { rows } = await db.query('SELECT title, author_name FROM book_details WHERE id = 1');
    res.json({
      googleClientId: config.googleClientId,
      bookTitle: rows[0]?.title || '',
      authorName: rows[0]?.author_name || '',
      openRegistration: config.openRegistration,
    });
  });

  r.post('/auth/google', async (req, res) => {
    const credential = text(req.body?.credential, { name: 'credential', required: true, max: 8000 });
    let info;
    try {
      info = await verifyGoogle(credential);
    } catch {
      throw new HttpError(401, 'Google sign-in could not be verified. Please try again.', 'bad_token');
    }
    const email = String(info.email || '').trim().toLowerCase();
    if (!email || !info.emailVerified) {
      throw new HttpError(403, 'Your Google email address is not verified.', 'unverified');
    }

    const isAuthor = config.authorEmails.includes(email);
    if (!isAuthor) {
      const access = await db.query('SELECT id, revoked_at FROM reviewer_access WHERE email = $1', [email]);
      if (access.rows.length > 0 && access.rows[0].revoked_at !== null) {
        throw new HttpError(
          403,
          'Your reviewer access has been revoked by the author.',
          'revoked',
        );
      }
      if (access.rows.length === 0) {
        if (config.openRegistration) {
          await db.query(
            `INSERT INTO reviewer_access (email, note)
             VALUES ($1, 'Self-registered reader')
             ON CONFLICT (email) DO NOTHING`,
            [email],
          );
        } else {
          throw new HttpError(
            403,
            'This Google account has not been invited. Ask the author to add your email address.',
            'not_invited',
          );
        }
      }
    }

    const role = isAuthor ? 'author' : 'reviewer';
    const name = String(info.name || '').slice(0, 200);
    const user = await db.tx(async (t) => {
      let existing = (await t.query('SELECT id FROM users WHERE google_sub = $1', [info.sub])).rows[0];
      if (!existing) existing = (await t.query('SELECT id FROM users WHERE lower(email) = $1', [email])).rows[0];
      let id;
      if (existing) {
        id = existing.id;
        await t.query(
          'UPDATE users SET google_sub = $2, email = $3, display_name = $4, role = $5, last_login_at = now() WHERE id = $1',
          [id, info.sub, email, name, role],
        );
      } else {
        const ins = await t.query(
          'INSERT INTO users (google_sub, email, display_name, role) VALUES ($1, $2, $3, $4) RETURNING id',
          [info.sub, email, name, role],
        );
        id = ins.rows[0].id;
      }
      if (!isAuthor) await t.query('UPDATE reviewer_access SET user_id = $1 WHERE email = $2', [id, email]);
      return { id, email, name, role };
    });

    issueSession(res, config, user.id);
    res.json({ user });
  });

  r.post('/auth/logout', (_req, res) => {
    clearSession(res, config);
    res.json({ ok: true });
  });

  r.get('/auth/me', (req, res) => {
    if (!req.user) {
      // Also drop a stale cookie (for example after access was removed).
      if (req.cookies?.session) clearSession(res, config);
      throw new HttpError(401, 'Not signed in.', 'unauthenticated');
    }
    res.json({ user: req.user });
  });

  return r;
}

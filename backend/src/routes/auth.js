import { Router } from 'express';
import { HttpError, text } from '../http.js';
import { issueSession, clearSession } from '../middleware/auth.js';
import { hashPassword, verifyPassword } from '../services/password.js';

export function authRoutes({ config, db, verifyGoogle }) {
  const r = Router();

  // Public: what the login page needs.
  r.get('/config', async (_req, res) => {
    try {
      const { rows } = await db.query('SELECT title, author_name FROM book_details WHERE id = 1');
      res.json({
        googleClientId: config.googleClientId,
        bookTitle: rows[0]?.title || 'Is It Me or You as Well?',
        authorName: rows[0]?.author_name || 'H.M. Abhilash',
        openRegistration: config.openRegistration,
      });
    } catch (err) {
      console.warn('[config] Database query failed in /config, using fallbacks:', err.message);
      res.json({
        googleClientId: config.googleClientId,
        bookTitle: 'Is It Me or You as Well?',
        authorName: 'H.M. Abhilash',
        openRegistration: config.openRegistration,
      });
    }
  });

  // Password-based Register
  r.post('/auth/register', async (req, res) => {
    const email = text(req.body?.email, { name: 'email', required: true, max: 254 }).toLowerCase();
    const rawPassword = req.body?.password;
    if (typeof rawPassword !== 'string' || rawPassword.length < 6) {
      throw new HttpError(400, 'Password must be at least 6 characters long.', 'invalid_password');
    }
    const name = text(req.body?.name, { name: 'name', required: false, max: 200 }) || email.split('@')[0];

    // Automatic role: Author if in AUTHOR_EMAILS, otherwise Reader (reviewer)
    const isAuthor = config.authorEmails.includes(email);
    if (!isAuthor && !config.openRegistration) {
      const access = await db.query('SELECT id, revoked_at FROM reviewer_access WHERE email = $1', [email]);
      if (access.rows.length === 0 || access.rows[0].revoked_at !== null) {
        throw new HttpError(403, 'This email address has not been invited to access the manuscript.', 'not_invited');
      }
    }

    const existing = await db.query('SELECT id, password_hash FROM users WHERE lower(email) = $1', [email]);
    if (existing.rows.length > 0 && existing.rows[0].password_hash) {
      throw new HttpError(400, 'An account with this email already exists. Please sign in instead.', 'account_exists');
    }

    const passwordHash = await hashPassword(rawPassword);
    const role = isAuthor ? 'author' : 'reviewer';

    let userId;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await db.query(
        `UPDATE users SET password_hash = $1, display_name = COALESCE(NULLIF(display_name, ''), $2), role = $3, last_login_at = now() WHERE id = $4`,
        [passwordHash, name, role, userId],
      );
    } else {
      const ins = await db.query(
        'INSERT INTO users (email, display_name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
        [email, name, role, passwordHash],
      );
      userId = ins.rows[0].id;
    }

    if (!isAuthor) {
      await db.query(
        `INSERT INTO reviewer_access (email, note, user_id)
         VALUES ($1, 'Registered reader', $2)
         ON CONFLICT (email) DO UPDATE SET user_id = $2`,
        [email, userId],
      );
    }

    issueSession(res, config, userId);
    res.status(201).json({ user: { id: userId, email, name, role } });
  });

  // Password-based Login
  r.post('/auth/login', async (req, res) => {
    const email = text(req.body?.email, { name: 'email', required: true, max: 254 }).toLowerCase();
    const rawPassword = req.body?.password;
    if (typeof rawPassword !== 'string' || !rawPassword) {
      throw new HttpError(400, 'Please enter your password.', 'missing_password');
    }

    const { rows } = await db.query(
      'SELECT id, email, display_name, role, password_hash FROM users WHERE lower(email) = $1',
      [email],
    );
    const u = rows[0];
    if (!u || !u.password_hash) {
      throw new HttpError(401, 'Incorrect email or password. Please try again.', 'invalid_credentials');
    }

    const valid = await verifyPassword(rawPassword, u.password_hash);
    if (!valid) {
      throw new HttpError(401, 'Incorrect email or password. Please try again.', 'invalid_credentials');
    }

    const isAuthor = config.authorEmails.includes(email);
    if (!isAuthor) {
      const access = await db.query('SELECT id, revoked_at FROM reviewer_access WHERE email = $1', [email]);
      if (access.rows.length > 0 && access.rows[0].revoked_at !== null) {
        throw new HttpError(403, 'Your reader access has been revoked by the author.', 'revoked');
      }
    }

    const role = isAuthor ? 'author' : 'reviewer';
    await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [u.id]);

    issueSession(res, config, u.id);
    res.json({ user: { id: u.id, email: u.email, name: u.display_name, role } });
  });

  // Google OAuth Login
  r.post('/auth/google', async (req, res) => {
    const credential = text(req.body?.credential, { name: 'credential', required: true, max: 8000 });
    let info;
    try {
      info = await verifyGoogle(credential);
    } catch (err) {
      console.error('[auth] Google verification error:', err.message);
      throw new HttpError(401, 'Google sign-in could not be verified. Please try again.', 'bad_token');
    }
    const email = String(info.email || '').trim().toLowerCase();
    if (!email || !info.emailVerified) {
      throw new HttpError(403, 'Your Google email address is not verified.', 'unverified');
    }

    // Role is automatically assigned: Author if in AUTHOR_EMAILS, otherwise Reviewer (Reader)
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
          'UPDATE users SET google_sub = COALESCE($2, google_sub), email = $3, display_name = $4, role = $5, last_login_at = now() WHERE id = $1',
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
      if (req.cookies?.session) clearSession(res, config);
      throw new HttpError(401, 'Not signed in.', 'unauthenticated');
    }
    res.json({ user: req.user });
  });

  return r;
}

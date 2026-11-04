import jwt from 'jsonwebtoken';
import { HttpError } from '../http.js';

export const COOKIE_NAME = 'session';
const SESSION_DAYS = 7;

export function cookieOptions(config) {
  const cross = config.crossSiteCookies;
  return {
    httpOnly: true, // JavaScript in the page can never read this cookie
    secure: config.isProd || cross,
    sameSite: cross ? 'none' : 'lax',
    path: '/',
  };
}

export function issueSession(res, config, userId) {
  const token = jwt.sign({ uid: userId }, config.sessionSecret, {
    algorithm: 'HS256',
    expiresIn: `${SESSION_DAYS}d`,
  });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions(config), maxAge: SESSION_DAYS * 86_400_000 });
}

export function clearSession(res, config) {
  res.clearCookie(COOKIE_NAME, cookieOptions(config));
}

/**
 * On every request: read the cookie, then look the user up in the database and
 * re-check that they are still allowed in. Removing a reviewer therefore takes
 * effect immediately, even if they are signed in.
 */
export function loadUser({ config, db }) {
  return async (req, res, next) => {
    req.user = null;
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();
    let payload;
    try {
      payload = jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] });
    } catch {
      return next();
    }
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.display_name, ra.id AS access_id, ra.revoked_at
         FROM users u
         LEFT JOIN reviewer_access ra ON ra.email = lower(u.email)
        WHERE u.id = $1`,
      [payload.uid],
    );
    const u = rows[0];
    if (!u) return next();
    const email = u.email.toLowerCase();
    let role = null;
    if (config.authorEmails.includes(email)) role = 'author';
    else if (u.access_id && !u.revoked_at) role = 'reviewer';
    if (role) req.user = { id: u.id, email: u.email, name: u.display_name, role };
    next();
  };
}

export function requireUser(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.', 'unauthenticated'));
  next();
}

export function requireAuthor(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Please sign in.', 'unauthenticated'));
  if (req.user.role !== 'author') return next(new HttpError(403, 'Only the author can do that.', 'forbidden'));
  next();
}

/**
 * Cross-site request forgery guard for anything that changes data.
 * 1. Browsers only send a custom header from our own pages (or origins allowed by CORS).
 * 2. If an Origin header is present it must be this site or an allowed origin.
 */
export function csrfGuard(config) {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.get('x-requested-with') !== 'fetch') {
      return next(new HttpError(403, 'Request blocked (missing security header).', 'csrf'));
    }
    const origin = req.get('origin');
    if (origin) {
      let sameHost = false;
      try {
        sameHost = new URL(origin).host === req.get('host');
      } catch {
        /* invalid origin */
      }
      if (!sameHost && !config.allowedOrigins.includes(origin.replace(/\/$/, ''))) {
        return next(new HttpError(403, 'Request blocked (unexpected origin).', 'csrf'));
      }
    }
    next();
  };
}

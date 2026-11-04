import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { HttpError } from './http.js';
import { loadUser, csrfGuard } from './middleware/auth.js';
import { authRoutes } from './routes/auth.js';
import { readerRoutes } from './routes/reader.js';
import { authorRoutes } from './routes/author.js';

/**
 * Builds the Express app. Everything it needs (database, file storage, Google
 * token checker) is passed in, which keeps it easy to test.
 */
export function createApp({ config, db, storage, verifyGoogle }) {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  const google = 'https://accounts.google.com/gsi/';
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'script-src': ["'self'", `${google}client`],
          'connect-src': ["'self'", google],
          'frame-src': [google],
          'style-src': ["'self'", "'unsafe-inline'", `${google}style`],
          'img-src': ["'self'", 'data:'],
          'upgrade-insecure-requests': config.isProd ? [] : null,
        },
      },
      // Google's sign-in popup needs to talk back to this page.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    }),
  );

  if (config.allowedOrigins.length > 0) {
    app.use(
      '/api',
      cors({
        origin: config.allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'X-Requested-With'],
      }),
    );
  }

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  if (config.rateLimit) {
    app.use('/api', rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
    app.use(
      '/api/auth/google',
      rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please wait a few minutes.' } }),
    );
    app.use(
      '/api/author/chapters/:id/import',
      rateLimit({ windowMs: 10 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many uploads. Please wait a few minutes.' } }),
    );
  }

  app.use('/api', csrfGuard(config));
  app.use('/api', loadUser({ config, db }));

  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });
  app.use('/api', authRoutes({ config, db, verifyGoogle }));
  app.use('/api/author', authorRoutes({ config, db, storage }));
  app.use('/api', readerRoutes({ db, storage }));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found.')));

  // The built website (production). In development Vite serves it instead.
  const indexHtml = path.join(config.staticDir, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.staticDir, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.set('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code });
    if (err?.name === 'MulterError') {
      const tooBig = err.code === 'LIMIT_FILE_SIZE';
      return res
        .status(tooBig ? 413 : 400)
        .json({ error: tooBig ? `That file is too large (limit ${config.maxUploadMb} MB).` : 'The upload could not be processed.' });
    }
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That is too much text to send at once.' });
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ error: 'The request was not valid JSON.' });
    }
    console.error('[error]', err);
    res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
  });

  return app;
}

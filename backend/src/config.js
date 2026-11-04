import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const backendRoot = path.resolve(here, '..');

function list(value) {
  return String(value || '')
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Reads settings from environment variables (see backend/.env.example).
 * Throws a readable error if something required is missing in production.
 */
export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const defaultDbUrl = env.DATABASE_URL || (isProd ? '' : 'local');
  const defaultSessionSecret = env.SESSION_SECRET || (isProd ? '' : 'dev_session_secret_for_local_development_mode_only_1234567890abcdef');
  const defaultGoogleClientId = env.GOOGLE_CLIENT_ID || (isProd ? '' : 'dev-mode');
  const defaultAuthorEmails = env.AUTHOR_EMAILS ? list(env.AUTHOR_EMAILS) : (isProd ? [] : ['author@example.com']);

  const config = {
    nodeEnv,
    isProd,
    port: Number(env.PORT) || 4000,
    databaseUrl: defaultDbUrl,
    sessionSecret: defaultSessionSecret,
    googleClientId: defaultGoogleClientId,
    authorEmails: defaultAuthorEmails,
    // Extra browser origins allowed to call the API (only needed if the website
    // and the API are hosted on different domains).
    allowedOrigins: [
      ...String(env.APP_ORIGIN || '')
        .split(',')
        .map((s) => s.trim().replace(/\/$/, ''))
        .filter(Boolean),
      ...(!isProd ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []),
    ],
    crossSiteCookies: env.CROSS_SITE_COOKIES === 'true',
    trustProxy: env.TRUST_PROXY ? env.TRUST_PROXY === 'true' : isProd,
    maxUploadMb: Number(env.MAX_UPLOAD_MB) || 10,
    rateLimit: env.DISABLE_RATE_LIMIT !== 'true',
    staticDir: env.STATIC_DIR || path.resolve(backendRoot, '../frontend/dist'),
    storage: {
      provider: (env.STORAGE_PROVIDER || 'local').toLowerCase(),
      localDir: env.LOCAL_STORAGE_DIR || path.resolve(backendRoot, 'uploads'),
      s3: {
        bucket: env.S3_BUCKET || '',
        endpoint: env.S3_ENDPOINT || '',
        region: env.S3_REGION || 'auto',
        accessKeyId: env.S3_ACCESS_KEY_ID || '',
        secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
        forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
      },
    },
  };

  const problems = [];
  if (!config.databaseUrl) problems.push('DATABASE_URL is missing (your Neon connection string).');
  if (!config.googleClientId) problems.push('GOOGLE_CLIENT_ID is missing.');
  if (config.authorEmails.length === 0) problems.push('AUTHOR_EMAILS is missing (your Google email address).');
  if (config.sessionSecret.length < 32) {
    problems.push('SESSION_SECRET must be a random string of at least 32 characters.');
  }
  if (config.storage.provider === 's3') {
    const s = config.storage.s3;
    if (!s.bucket || !s.accessKeyId || !s.secretAccessKey) {
      problems.push('STORAGE_PROVIDER=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.');
    }
  } else if (config.storage.provider !== 'local') {
    problems.push('STORAGE_PROVIDER must be "local" or "s3".');
  }
  if (isProd && config.storage.provider === 'local') {
    console.warn(
      '[config] WARNING: STORAGE_PROVIDER=local in production. Most hosts delete local files on restart. Use s3 (e.g. Cloudflare R2) to keep uploaded files.',
    );
  }
  config.problems = problems;
  return config;
}

export function assertConfig(config) {
  if (config.problems.length > 0) {
    throw new Error(
      'Configuration problems:\n - ' + config.problems.join('\n - ') + '\nSee backend/.env.example and the README.',
    );
  }
}

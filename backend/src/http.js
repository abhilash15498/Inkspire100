/** An error whose message is safe to show to the user. */
export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const bad = (msg) => new HttpError(400, msg);
export const notFound = (msg = 'Not found.') => new HttpError(404, msg);

/** Parses a route id like "12". Anything else is treated as "not found". */
export function parseId(value) {
  if (!/^\d{1,9}$/.test(String(value))) throw notFound();
  const n = Number(value);
  if (n < 1) throw notFound();
  return n;
}

/** Required/optional text with length limits. Trims and normalises line endings. */
export function text(value, { name, min = 0, max, required = false, trim = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw bad(`${name} is required.`);
    return undefined;
  }
  if (typeof value !== 'string') throw bad(`${name} must be text.`);
  let s = value.replace(/\r\n?/g, '\n').replace(/\u0000/g, '');
  if (trim) s = s.trim();
  if (required && s.length === 0) throw bad(`${name} is required.`);
  if (s.length < min) throw bad(`${name} must be at least ${min} characters.`);
  if (max && s.length > max) throw bad(`${name} must be at most ${max} characters.`);
  return s;
}

export function integer(value, { name, min, max, required = false }) {
  if (value === undefined || value === null || value === '') {
    if (required) throw bad(`${name} is required.`);
    return undefined;
  }
  const n = typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value) : value;
  if (!Number.isInteger(n)) throw bad(`${name} must be a whole number.`);
  if (n < min || n > max) throw bad(`${name} must be between ${min} and ${max}.`);
  return n;
}

export function countWords(s) {
  const t = String(s || '').trim();
  return t ? t.split(/\s+/).length : 0;
}

export const CATEGORIES = ['general', 'plot', 'character', 'pacing', 'writing'];

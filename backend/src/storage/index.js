import { LocalStorage } from './local.js';
import { S3Storage } from './s3.js';

/**
 * Storage providers all expose: put(key, buffer, contentType), get(key) -> Buffer, delete(key).
 * To use another service, add a file with those three methods and register it here.
 */
export function createStorage(config) {
  const { provider, localDir, s3 } = config.storage;
  if (provider === 's3') return new S3Storage(s3);
  return new LocalStorage(localDir);
}

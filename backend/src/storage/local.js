import fs from 'node:fs/promises';
import path from 'node:path';

const SAFE_KEY = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;

/** Stores files in a folder on the server's disk. Good for local development. */
export class LocalStorage {
  constructor(rootDir) {
    this.root = path.resolve(rootDir);
  }

  resolve(key) {
    if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error('Invalid storage key');
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key, buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer, { mode: 0o600 });
  }

  async get(key) {
    return fs.readFile(this.resolve(key));
  }

  async delete(key) {
    try {
      await fs.unlink(this.resolve(key));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
}

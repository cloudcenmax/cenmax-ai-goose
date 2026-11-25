import {constants} from 'node:fs';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {CenmaxError, secret} from './oauth.mjs';

export const DEFAULT_ROOT = path.join(os.homedir(), '.config', 'cenmax-ai', 'goose');
export class RefreshFence {
  constructor(root = DEFAULT_ROOT) { this.root = path.resolve(root); }
  async prepare() {
    await fs.mkdir(this.root, {recursive: true, mode: 0o700});
    for (let current = this.root; current !== path.dirname(current); current = path.dirname(current)) {
      const stat = await fs.lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new CenmaxError();
    }
    const stat = await fs.lstat(this.root);
    if ((stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())) throw new CenmaxError();
  }
  async claim(value) {
    await this.prepare();
    const name = createHash('sha256').update(secret(value)).digest('hex');
    let file;
    try {
      file = await fs.open(path.join(this.root, `${name}.spent`), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      await file.writeFile('Cenmax AI rotating grant dispatched.\n'); await file.sync(); await this.syncDirectory();
    } catch { throw new CenmaxError('Cenmax AI sign-in must be renewed. Sign in again.'); }
    finally { await file?.close(); }
  }
  async syncDirectory() {
    const directory = await fs.open(this.root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await directory.sync(); } finally { await directory.close(); }
  }
}

export class TokenStore extends RefreshFence {
  constructor(oauth, root = DEFAULT_ROOT) { super(root); this.oauth = oauth; this.file = path.join(this.root, 'session.json'); this.lock = path.join(this.root, 'session.lock'); }
  async locked(action) {
    await this.prepare(); let handle;
    for (let i = 0; i < 100; i++) {
      try { handle = await fs.open(this.lock, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600); break; }
      catch (error) { if (error.code !== 'EEXIST') throw new CenmaxError(); await delay(100); }
    }
    if (!handle) throw new CenmaxError('Cenmax AI credentials are busy. Try again shortly.');
    try { return await action(); } finally { await handle.close(); await fs.unlink(this.lock); }
  }
  async read() {
    let handle;
    try {
      handle = await fs.open(this.file, constants.O_RDONLY | constants.O_NOFOLLOW);
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 65536 || (stat.mode & 0o077) !== 0 || (process.getuid && stat.uid !== process.getuid())) throw new CenmaxError();
      const value = JSON.parse(await handle.readFile('utf8'));
      secret(value.access); secret(value.refresh);
      if (!Number.isFinite(value.expires)) throw new CenmaxError();
      return value;
    } catch { throw new CenmaxError('Sign in with Cenmax AI first.'); }
    finally { await handle?.close(); }
  }
  async write(value) {
    const temp = path.join(this.root, `${randomBytes(16).toString('hex')}.tmp`); let handle;
    try {
      handle = await fs.open(temp, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      await handle.writeFile(JSON.stringify(value)); await handle.sync(); await handle.close(); handle = null;
      await fs.rename(temp, this.file); await this.syncDirectory();
    } finally { await handle?.close(); await fs.unlink(temp).catch(() => {}); }
  }
  async login(show) { return this.locked(async () => { const value = await this.oauth.login(show); await this.write(value); }); }
  async token() {
    return this.locked(async () => {
      let value = await this.read();
      // Cover Goose's five-minute command-auth cache plus a small clock margin.
      if (value.expires <= Date.now() + 330_000) {
        try { await this.claim(value.refresh); value = await this.oauth.refresh(value.refresh); await this.write(value); }
        catch { await fs.unlink(this.file).catch(() => {}); await this.syncDirectory(); throw new CenmaxError('Cenmax AI sign-in must be renewed. Sign in again.'); }
      }
      return value.access;
    });
  }
  async logout() { return this.locked(async () => { const value = await this.read(); await this.oauth.revoke(value); await fs.unlink(this.file); await this.syncDirectory(); }); }
}

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { TrustedRoot } from './generic-trusted-root.js';

export class GenericLockRejected extends Error { constructor(readonly code: string) { super(code); } }

export interface LockOwner { readonly token: string; readonly pid: number; readonly acquiredAt: string; }

export async function acquireGenericLock(root: TrustedRoot, name: string): Promise<{ owner: LockOwner; release: () => Promise<void> }> {
  if (!/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(name)) throw new GenericLockRejected('INVALID_LOCK_NAME');
  const path = await root.validateStoragePath(`locks/${name}.lock`, { allowMissingLeaf: true });
  const owner = { token: randomUUID(), pid: process.pid, acquiredAt: new Date().toISOString() } satisfies LockOwner;
  let created = false;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await mkdir(path, { recursive: false, mode: 0o700 });
    created = true;
    await writeFile(join(path, 'owner.json'), `${JSON.stringify(owner)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (created) { try { await rm(path, { recursive: true, force: false }); } catch { /* preserve the original failure */ } }
    throw new GenericLockRejected((error as NodeJS.ErrnoException).code === 'EEXIST' ? 'LOCK_CONFLICT' : 'LOCK_UNAVAILABLE');
  }
  let released = false;
  return { owner, release: async () => { if (released) return; released = true; const current = JSON.parse(await readFile(join(path, 'owner.json'), 'utf8')) as LockOwner; if (current.token !== owner.token) throw new GenericLockRejected('LOCK_OWNERSHIP_CHANGED'); await rm(path, { recursive: true, force: false }); } };
}

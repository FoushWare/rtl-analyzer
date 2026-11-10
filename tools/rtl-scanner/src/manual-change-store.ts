import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ReviewIdentity } from './review-session.js';
import { validateReviewIdentity } from './review-session.js';

export const DEFAULT_MANUAL_CHANGE_STORE_PATH = process.env.RTL_MANUAL_CHANGE_STORE_PATH || join(homedir(), '.rtl-migration-analyzer', 'manual-changes-v1.json');
export interface ManualChange extends ReviewIdentity { readonly changeId: string; readonly beforeSourceSha256: string; readonly afterSourceSha256: string; readonly beforeText: string; readonly afterText: string; readonly timestamp: string; readonly sourceChanged: boolean; readonly integritySha256: string }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export class ManualChangeStore {
  private changes: ManualChange[] = []; private loaded = false;
  constructor(readonly path = DEFAULT_MANUAL_CHANGE_STORE_PATH) {}
  async load(): Promise<void> { try { this.changes = JSON.parse(await readFile(this.path, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('MANUAL_CHANGE_STORE_UNAVAILABLE'); this.changes = []; } this.loaded = true; }
  list(identity: ReviewIdentity): ManualChange[] { validateReviewIdentity(identity); return this.changes.filter(x => x.findingId === identity.findingId && x.sourcePath === identity.sourcePath && x.inputDigest === identity.inputDigest && x.policyDigest === identity.policyDigest); }
  async append(input: Omit<ManualChange, 'changeId'|'timestamp'|'integritySha256'|'sourceChanged'>): Promise<ManualChange> { if (!this.loaded) throw new Error('MANUAL_CHANGE_STORE_NOT_LOADED'); validateReviewIdentity(input); if (!/^[a-f0-9]{64}$/.test(input.beforeSourceSha256) || !/^[a-f0-9]{64}$/.test(input.afterSourceSha256) || input.beforeSourceSha256 === input.afterSourceSha256) throw new Error('MANUAL_CHANGE_SOURCE_NOT_CHANGED'); const value = { ...input, changeId: randomUUID(), timestamp: new Date().toISOString(), sourceChanged: true, integritySha256: '' } as Omit<ManualChange,'integritySha256'>; const item = { ...value, integritySha256: digest(value) }; this.changes.push(item); await mkdir(dirname(this.path), { recursive: true, mode: 0o700 }); const tmp = `${this.path}.${process.pid}.tmp`; await writeFile(tmp, `${JSON.stringify(this.changes, null, 2)}\n`, { mode: 0o600, flag: 'wx' }); await rename(tmp, this.path); return item; }
}

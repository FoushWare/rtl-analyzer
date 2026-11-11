import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TrustedRoot } from './generic-trusted-root.js';
import { acquireGenericLock } from './generic-lock.js';

export const GENERIC_PERSISTENCE_VERSION = 1 as const;
export class GenericPersistenceRejected extends Error { constructor(readonly code: string) { super(code); } }
export interface PersistedRecord { readonly id: string; readonly kind: string; readonly formatVersion: number; readonly integritySha256: string; readonly [key: string]: unknown }
export interface RecordFile { readonly formatVersion: 1; readonly records: readonly PersistedRecord[] }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const unsigned = (record: PersistedRecord): unknown => { const { integritySha256: _ignored, ...payload } = record; return payload; };
export const recordIntegrity = (record: PersistedRecord): string => digest(unsigned(record));

function validate(record: unknown, maxBytes: number): PersistedRecord {
  if (!record || typeof record !== 'object') throw new GenericPersistenceRejected('INVALID_RECORD');
  const value = record as PersistedRecord;
  if (!value.id || !value.kind || value.formatVersion !== GENERIC_PERSISTENCE_VERSION || !/^[a-f0-9]{64}$/.test(value.integritySha256) || value.integritySha256 !== recordIntegrity(value)) throw new GenericPersistenceRejected('RECORD_INTEGRITY_MISMATCH');
  if (JSON.stringify(value).length > maxBytes) throw new GenericPersistenceRejected('RECORD_TOO_LARGE');
  return Object.freeze({ ...value });
}

async function durableWrite(path: string, content: string): Promise<void> {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, path);
  try { const directory = await open(dirname(path), 'r'); await directory.sync(); await directory.close(); } catch { /* directory fsync is unavailable on some platforms */ }
}

export class GenericRecordStore {
  constructor(private readonly root: TrustedRoot, private readonly name: string, private readonly maxBytes = 1_000_000) {}
  private async path(): Promise<string> { return this.root.validateStoragePath(`records/${this.name}.json`, { allowMissingLeaf: true }); }
  async list(): Promise<readonly PersistedRecord[]> {
    const path = await this.path();
    try {
      const raw = JSON.parse(await readFile(path, 'utf8')) as RecordFile;
      if (raw.formatVersion !== 1 || !Array.isArray(raw.records)) throw new GenericPersistenceRejected('INVALID_RECORD_FILE');
      const seen = new Set<string>();
      return raw.records.map(record => { const valid = validate(record, this.maxBytes); if (seen.has(valid.id)) throw new GenericPersistenceRejected('DUPLICATE_RECORD'); seen.add(valid.id); return valid; });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      if (error instanceof GenericPersistenceRejected) throw error;
      throw new GenericPersistenceRejected('PERSISTENCE_CORRUPT');
    }
  }
  async append(record: Omit<PersistedRecord, 'integritySha256'>): Promise<PersistedRecord> {
    const complete = validate({ ...record, integritySha256: recordIntegrity(record as PersistedRecord) }, this.maxBytes);
    const lock = await acquireGenericLock(this.root, `records-${this.name}`);
    try {
      const current = [...await this.list()];
      if (current.some(item => item.id === complete.id)) throw new GenericPersistenceRejected('DUPLICATE_RECORD');
      const records = [...current, complete].sort((a, b) => a.id.localeCompare(b.id, 'en'));
      const path = await this.path();
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await durableWrite(path, `${JSON.stringify({ formatVersion: 1, records })}\n`);
      return complete;
    } finally { await lock.release(); }
  }
}

export function createPersistedRecord(record: Omit<PersistedRecord, 'integritySha256'>): PersistedRecord {
  return validate({ ...record, integritySha256: recordIntegrity(record as PersistedRecord) }, 1_000_000);
}

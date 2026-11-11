import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, lstat, open, readFile, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { TrustedRoot } from './generic-trusted-root.js';
import { acquireGenericLock } from './generic-lock.js';
import { GenericRecordStore } from './generic-persistence.js';
import type { GenericApplyReceipt } from './generic-apply.js';

export const GENERIC_ROLLBACK_CONFIRMATION = 'GENERIC_ROLLBACK_CONFIRMED';
export type GenericRollbackBoundary = 'before-backup-read' | 'before-rollback-replacement' | 'after-rollback-replacement' | 'before-rollback-journal' | 'after-rollback-journal' | 'before-rollback-receipt' | 'after-rollback-receipt';
export interface GenericRollbackHooks { readonly failAt?: GenericRollbackBoundary; readonly onBoundary?: (boundary: GenericRollbackBoundary) => void; }
export class GenericRollbackRejected extends Error { constructor(readonly code: string) { super(code); } }
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
async function atomicRestore(path: string, text: string, mode: number): Promise<void> { const temp = `${path}.rtl-generic-rollback.${process.pid}.${randomUUID()}.tmp`; const handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, mode & 0o777); try { await handle.writeFile(text, 'utf8'); await handle.sync(); } finally { await handle.close(); } await rename(temp, path); }

export class GenericRollbackService {
  constructor(private readonly root: TrustedRoot, private readonly hooks: GenericRollbackHooks = {}) {}
  private checkpoint(boundary: GenericRollbackBoundary): void { this.hooks.onBoundary?.(boundary); if (this.hooks.failAt === boundary) throw new GenericRollbackRejected(`INJECTED_FAILURE:${boundary}`); }
  async rollback(receipt: GenericApplyReceipt, confirmation: string): Promise<'Rolled Back' | 'Already Rolled Back'> {
    if (confirmation !== GENERIC_ROLLBACK_CONFIRMATION) throw new GenericRollbackRejected('ROLLBACK_CONFIRMATION_REQUIRED');
    const lock = await acquireGenericLock(this.root, `apply-${sha(this.root.projectRoot).slice(0, 24)}`);
    try {
      const path = await this.root.validateProjectPath(receipt.sourcePath, { file: true });
      const currentHandle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      let text: string; try { text = await currentHandle.readFile('utf8'); } finally { await currentHandle.close(); }
      if (sha(text) === receipt.originalDigest) return 'Already Rolled Back';
      if (sha(text) !== receipt.candidateDigest) throw new GenericRollbackRejected('ROLLBACK_CONFLICT');
      const backupPath = await this.root.validateStoragePath(receipt.backupPath, { });
      this.checkpoint('before-backup-read');
      const backup = await readFile(backupPath, 'utf8');
      if (sha(backup) !== receipt.backupDigest || sha(backup) !== receipt.originalDigest) throw new GenericRollbackRejected('BACKUP_INTEGRITY_MISMATCH');
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink > 1) throw new GenericRollbackRejected('UNSAFE_SOURCE_FILE');
      this.checkpoint('before-rollback-replacement');
      await atomicRestore(path, backup, info.mode);
      this.checkpoint('after-rollback-replacement');
      if (sha(await readFile(path, 'utf8')) !== receipt.originalDigest) throw new GenericRollbackRejected('ROLLBACK_DIGEST_MISMATCH');
      const journalStore = new GenericRecordStore(this.root, 'transactions');
      const journals = await journalStore.list();
      const rank: Record<string, number> = { Prepared: 1, Applying: 2, Applied: 3, Failed: 4, 'Recovery Required': 5, 'Rolled Back': 6 };
      const currentJournal = journals.filter(item => (item as { transactionId?: string }).transactionId === receipt.transactionId).sort((a, b) => (rank[(a as { state?: string }).state ?? ''] ?? 0) - (rank[(b as { state?: string }).state ?? ''] ?? 0)).at(-1) as never;
      if (!currentJournal || (currentJournal as { state?: string }).state !== 'Applied') throw new GenericRollbackRejected('JOURNAL_NOT_APPLIED');
      this.checkpoint('before-rollback-journal');
      const rollbackJournal = { ...(currentJournal as object), id: `${receipt.transactionId}:Rolled Back`, state: 'Rolled Back', integritySha256: undefined } as never;
      await journalStore.append(rollbackJournal);
      this.checkpoint('after-rollback-journal');
      const rollbackReceipt = { ...receipt, id: `${receipt.transactionId}:rollback`, status: 'Rolled Back', rolledBackAt: new Date().toISOString() };
      this.checkpoint('before-rollback-receipt');
      await new GenericRecordStore(this.root, 'receipts').append({ ...rollbackReceipt, kind: 'generic-rollback-receipt', formatVersion: 1, integritySha256: undefined } as never);
      this.checkpoint('after-rollback-receipt');
      return 'Rolled Back';
    } catch (error) { if (error instanceof GenericRollbackRejected) throw error; throw new GenericRollbackRejected('ROLLBACK_INCOMPLETE'); }
    finally { await lock.release(); }
  }
}

import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import type { ProjectIdentity } from './generic-authorization.js';
import { projectIdentityDigest } from './generic-authorization.js';
import { GenericRecordStore, type PersistedRecord } from './generic-persistence.js';
import type { TrustedRoot } from './generic-trusted-root.js';
import { openSecureRead } from './secure-file-access.js';

export type GenericRecoveryStatus = 'COMMITTED' | 'ROLLED_BACK' | 'RECOVERY_REQUIRED' | 'ROLLBACK_CONFLICT' | 'CORRUPTED_RECORD' | 'UNSUPPORTED_STATE';
export interface GenericRecoveryAssessment { readonly transactionId: string; readonly status: GenericRecoveryStatus; readonly projectIdentityDigest?: string; readonly sourcePath?: string; readonly currentDigest?: string; readonly originalDigest?: string; readonly candidateDigest?: string; readonly backupDigest?: string; readonly receiptPresent: boolean; readonly journalStates: readonly string[]; readonly reason: string; }
export class GenericRecoveryRejected extends Error { constructor(readonly code: string) { super(code); } }
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const stateRank: Record<string, number> = { Prepared: 1, Applying: 2, Applied: 3, Failed: 4, 'Recovery Required': 5, 'Rolled Back': 6 };
const readNoFollow = async (path: string): Promise<string> => { const handle = await openSecureRead(path); try { return await handle.readFile('utf8'); } finally { await handle.close(); } };

export class GenericRecoveryService {
  constructor(private readonly root: TrustedRoot, private readonly project: ProjectIdentity) {}

  async assess(transactionId: string): Promise<GenericRecoveryAssessment> {
    const expectedProject = projectIdentityDigest(this.project);
    let journals: readonly PersistedRecord[];
    let receipts: readonly PersistedRecord[];
    try { journals = await new GenericRecordStore(this.root, 'transactions').list(); receipts = await new GenericRecordStore(this.root, 'receipts').list(); } catch (error) { return { transactionId, status: 'CORRUPTED_RECORD', receiptPresent: false, journalStates: [], reason: error instanceof Error ? error.message : 'PERSISTENCE_CORRUPT' }; }
    const matching = journals.filter(record => (record as { transactionId?: string }).transactionId === transactionId).sort((a, b) => (stateRank[(a as { state?: string }).state ?? ''] ?? 0) - (stateRank[(b as { state?: string }).state ?? ''] ?? 0));
    if (!matching.length) return { transactionId, status: 'CORRUPTED_RECORD', receiptPresent: false, journalStates: [], reason: 'TRANSACTION_NOT_FOUND' };
    const latest = matching.at(-1)! as PersistedRecord & { projectIdentityDigest?: string; state?: string; files?: readonly [{ path: string; sourceDigest: string; candidateDigest: string }] };
    const receipt = receipts.find(record => (record as { transactionId?: string }).transactionId === transactionId) as (PersistedRecord & { sourcePath?: string; originalDigest?: string; candidateDigest?: string; backupPath?: string; backupDigest?: string }) | undefined;
    if (latest.projectIdentityDigest !== expectedProject) return { transactionId, status: 'RECOVERY_REQUIRED', projectIdentityDigest: latest.projectIdentityDigest, receiptPresent: Boolean(receipt), journalStates: matching.map(item => String((item as { state?: string }).state)), reason: 'PROJECT_IDENTITY_MISMATCH' };
    if (!latest.files?.length || !['Prepared', 'Applying', 'Applied', 'Failed', 'Recovery Required', 'Rolled Back'].includes(latest.state ?? '')) return { transactionId, status: 'UNSUPPORTED_STATE', projectIdentityDigest: latest.projectIdentityDigest, receiptPresent: Boolean(receipt), journalStates: matching.map(item => String((item as { state?: string }).state)), reason: 'UNSUPPORTED_JOURNAL_STATE' };
    const file = latest.files[0];
    let currentDigest: string | undefined;
    try { const path = await this.root.validateProjectPath(file.path, { file: true }); currentDigest = sha(await readNoFollow(path)); } catch { return { transactionId, status: 'RECOVERY_REQUIRED', projectIdentityDigest: latest.projectIdentityDigest, sourcePath: file.path, originalDigest: file.sourceDigest, candidateDigest: file.candidateDigest, receiptPresent: Boolean(receipt), journalStates: matching.map(item => String((item as { state?: string }).state)), reason: 'SOURCE_UNAVAILABLE' }; }
    let backupDigest: string | undefined;
    if (receipt?.backupPath) { try { const backupPath = await this.root.validateStoragePath(receipt.backupPath); backupDigest = sha(await readFile(backupPath, 'utf8')); } catch { /* reported as incomplete below */ } }
    const backupValid = Boolean(receipt?.backupDigest && backupDigest === receipt.backupDigest && backupDigest === file.sourceDigest);
    const receiptValid = Boolean(receipt && receipt.sourcePath === file.path && receipt.originalDigest === file.sourceDigest && receipt.candidateDigest === file.candidateDigest && backupValid);
    const base = { transactionId, projectIdentityDigest: latest.projectIdentityDigest, sourcePath: file.path, currentDigest, originalDigest: file.sourceDigest, candidateDigest: file.candidateDigest, backupDigest, receiptPresent: Boolean(receipt), journalStates: matching.map(item => String((item as { state?: string }).state)) };
    if (latest.state === 'Rolled Back' && currentDigest === file.sourceDigest && backupValid) return { ...base, status: 'ROLLED_BACK', reason: 'ROLLBACK_COMPLETE' };
    if (currentDigest !== file.sourceDigest && currentDigest !== file.candidateDigest) return { ...base, status: 'ROLLBACK_CONFLICT', reason: 'CURRENT_SOURCE_DOES_NOT_MATCH_TRANSACTION' };
    if (latest.state === 'Applied' && receiptValid && currentDigest === file.candidateDigest) return { ...base, status: 'COMMITTED', reason: 'APPLY_COMPLETE' };
    return { ...base, status: 'RECOVERY_REQUIRED', reason: latest.state === 'Applied' && !receiptValid ? 'MISSING_OR_INVALID_RECEIPT' : 'INCOMPLETE_TRANSACTION' };
  }

  async list(): Promise<GenericRecoveryAssessment[]> {
    let journals: readonly PersistedRecord[];
    try { journals = await new GenericRecordStore(this.root, 'transactions').list(); } catch { return [{ transactionId: 'unknown', status: 'CORRUPTED_RECORD', receiptPresent: false, journalStates: [], reason: 'PERSISTENCE_CORRUPT' }]; }
    const ids = [...new Set(journals.map(record => String((record as { transactionId?: string }).transactionId)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
    return Promise.all(ids.map(id => this.assess(id)));
  }
}

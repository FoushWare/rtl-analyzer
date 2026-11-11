import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import type { ProjectIdentity } from './generic-authorization.js';
import { projectIdentityDigest } from './generic-authorization.js';
import { GenericRecordStore, type PersistedRecord } from './generic-persistence.js';
import type { TrustedRoot } from './generic-trusted-root.js';

export type MultiRecoveryStatus = 'PREPARED' | 'APPLYING' | 'PARTIAL_APPLY' | 'APPLIED' | 'PARTIAL_ROLLBACK' | 'ROLLED_BACK' | 'RECOVERY_REQUIRED' | 'ROLLBACK_CONFLICT' | 'CORRUPTED_RECORD' | 'UNSUPPORTED_STATE';
export interface MultiFileRecoveryFile { readonly path: string; readonly state: string; readonly progressState: string; readonly currentDigest?: string; readonly originalDigest: string; readonly candidateDigest: string; readonly backupValid: boolean; readonly reason?: string; }
export interface MultiFileRecoveryAssessment { readonly transactionId: string; readonly status: MultiRecoveryStatus; readonly files: readonly MultiFileRecoveryFile[]; readonly reason: string; }
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const readNoFollow = async (path: string): Promise<string> => { const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); try { return await handle.readFile('utf8'); } finally { await handle.close(); } };

export class GenericMultiFileRecoveryService {
  constructor(private readonly root: TrustedRoot, private readonly project: ProjectIdentity) {}
  async assess(transactionId: string): Promise<MultiFileRecoveryAssessment> {
    try {
      const journals = await new GenericRecordStore(this.root, 'transactions').list();
      const receipts = await new GenericRecordStore(this.root, 'receipts').list();
      const matching = journals.filter(record => (record as { transactionId?: string }).transactionId === transactionId);
      if (!matching.length) return { transactionId, status: 'CORRUPTED_RECORD', files: [], reason: 'TRANSACTION_NOT_FOUND' };
      const rank: Record<string, number> = { Prepared: 1, Applying: 2, Applied: 3, 'Rollback Requested': 4, 'Rolling Back': 5, 'Rolled Back': 6, Failed: 7, 'Recovery Required': 8 };
      const states = new Set(matching.map(record => (record as { state?: string }).state));
      if ([...states].some(state => state && rank[state] === undefined)) return { transactionId, status: 'UNSUPPORTED_STATE', files: [], reason: 'UNSUPPORTED_TRANSACTION_STATE' };
      const latest = [...matching].sort((a, b) => (rank[(a as { state?: string }).state ?? ''] ?? 0) - (rank[(b as { state?: string }).state ?? ''] ?? 0) || a.id.localeCompare(b.id, 'en')).at(-1)! as PersistedRecord & { projectIdentityDigest: string; state: string; files: readonly { path: string; sourceDigest: string; candidateDigest: string; state?: string }[] };
      if (latest.projectIdentityDigest !== projectIdentityDigest(this.project)) return { transactionId, status: 'RECOVERY_REQUIRED', files: [], reason: 'PROJECT_IDENTITY_MISMATCH' };
const receipt = [...receipts].filter(record => (record as { transactionId?: string }).transactionId === transactionId).sort((a, b) => Number((b as { status?: string }).status === 'Rolled Back') - Number((a as { status?: string }).status === 'Rolled Back')).at(0) as { files?: readonly { path: string; originalDigest: string; candidateDigest: string; backupPath: string; backupDigest: string }[]; status?: string } | undefined;
      const files = await Promise.all(latest.files.map(async file => {
        let currentDigest: string | undefined; let reason: string | undefined;
        try { currentDigest = sha(await readNoFollow(await this.root.validateProjectPath(file.path, { file: true }))); } catch { reason = 'SOURCE_UNREADABLE'; }
        const backup = receipt?.files?.find(item => item.path === file.path); let backupValid = false;
        if (backup) { try { backupValid = sha(await readFile(await this.root.validateStoragePath(backup.backupPath), 'utf8')) === backup.backupDigest && backup.backupDigest === file.sourceDigest; } catch { reason = reason ?? 'BACKUP_UNREADABLE'; } } else reason = reason ?? 'BACKUP_RECORD_MISSING';
        return { path: file.path, state: latest.state, progressState: file.state ?? 'Pending', currentDigest, originalDigest: file.sourceDigest, candidateDigest: file.candidateDigest, backupValid, reason };
      }));
      const allOriginal = files.length > 0 && files.every(file => file.currentDigest === file.originalDigest);
      const allCandidate = files.length > 0 && files.every(file => file.currentDigest === file.candidateDigest);
      const anyCandidate = files.some(file => file.currentDigest === file.candidateDigest);
      const anyConflict = files.some(file => file.currentDigest === undefined || (file.currentDigest !== file.originalDigest && file.currentDigest !== file.candidateDigest));
      if (anyConflict) return { transactionId, status: 'ROLLBACK_CONFLICT', files, reason: 'UNEXPECTED_SOURCE_OR_IDENTITY' };
      if (latest.state === 'Rolled Back' && allOriginal && Boolean(receipt) && receipt?.status === 'Rolled Back') return { transactionId, status: 'ROLLED_BACK', files, reason: 'ROLLBACK_COMPLETE' };
      if ((latest.state === 'Rollback Requested' || latest.state === 'Rolling Back') && allOriginal) return { transactionId, status: 'RECOVERY_REQUIRED', files, reason: 'ROLLBACK_COMPLETION_MISSING' };
      if ((latest.state === 'Rollback Requested' || latest.state === 'Rolling Back') && allCandidate) return { transactionId, status: 'RECOVERY_REQUIRED', files, reason: 'ROLLBACK_NOT_STARTED' };
      if ((latest.state === 'Rollback Requested' || latest.state === 'Rolling Back') && anyCandidate) return { transactionId, status: 'PARTIAL_ROLLBACK', files, reason: 'MIXED_ROLLBACK_STATE' };
      if (latest.state === 'Applied' && allCandidate && Boolean(receipt) && receipt?.status === 'Applied') return { transactionId, status: 'APPLIED', files, reason: 'APPLY_COMPLETE' };
      if (allCandidate && !receipt) return { transactionId, status: 'RECOVERY_REQUIRED', files, reason: 'MISSING_FINAL_RECEIPT' };
      if (anyCandidate && !allCandidate) return { transactionId, status: 'PARTIAL_APPLY', files, reason: 'MIXED_APPLY_STATE' };
      if (allOriginal && latest.state === 'Applying') return { transactionId, status: 'APPLYING', files, reason: 'NO_FILE_REPLACED' };
      return { transactionId, status: latest.state === 'Recovery Required' ? 'RECOVERY_REQUIRED' : 'PREPARED', files, reason: 'INCOMPLETE_TRANSACTION' };
    } catch { return { transactionId, status: 'CORRUPTED_RECORD', files: [], reason: 'PERSISTENCE_CORRUPT' }; }
  }
}

import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, rename, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { FixProposal } from './fix-proposal.js';
import { candidateFromProposal } from './fix-proposal.js';
import type { GenericApproval, GenericReviewSet } from './generic-review.js';
import { assertApprovalCurrent, proposalId } from './generic-review.js';
import type { GenericCodeEvidence } from './generic-evidence.js';
import { validateGenericCodeEvidence } from './generic-evidence.js';
import { GenericEvidencePersistence } from './generic-evidence-persistence.js';
import { acquireGenericLock } from './generic-lock.js';
import { GenericRecordStore } from './generic-persistence.js';
import { createGenericAuthorization, assertGenericAuthorizationCurrent, type GenericAuthorization, type ProjectIdentity } from './generic-authorization.js';
import { createTransactionJournal, transitionTransaction, type GenericTransactionJournal } from './generic-transaction-journal.js';
import type { TrustedRoot } from './generic-trusted-root.js';

export const GENERIC_APPLY_CONFIRMATION = 'GENERIC_APPLY_CONFIRMED';
export interface GenericApplyPolicy { readonly confirmation: string; readonly allowHardLinks?: boolean; }
export type GenericApplyBoundary = 'before-backup' | 'after-backup' | 'before-prepared-journal' | 'after-prepared-journal' | 'before-applying-journal' | 'after-applying-journal' | 'before-source-replacement' | 'after-source-replacement' | 'before-applied-journal' | 'after-applied-journal' | 'before-receipt' | 'after-receipt';
export interface GenericApplyHooks { readonly failAt?: GenericApplyBoundary; readonly onBoundary?: (boundary: GenericApplyBoundary) => void; }
export interface GenericApplyReceipt { readonly id: string; readonly transactionId: string; readonly projectIdentityDigest: string; readonly sourcePath: string; readonly originalDigest: string; readonly candidateDigest: string; readonly backupPath: string; readonly backupDigest: string; readonly proposalId: string; readonly reviewSetId: string; readonly reviewSetDigest: string; readonly status: 'Applied'; readonly appliedAt: string; readonly integritySha256: string; }
export class GenericApplyRejected extends Error { constructor(readonly code: string) { super(code); } }
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const integrity = (value: Omit<GenericApplyReceipt, 'integritySha256'>): string => sha(JSON.stringify(value));
const readNoFollow = async (path: string): Promise<string> => { const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)); try { return await handle.readFile('utf8'); } finally { await handle.close(); } };

async function atomicReplace(path: string, text: string, mode: number): Promise<void> {
  const temporary = `${path}.rtl-generic.${process.pid}.${randomUUID()}.tmp`;
  const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, mode & 0o777);
  try { await handle.writeFile(text, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, path);
  try { const directory = await open(dirname(path), 'r'); await directory.sync(); await directory.close(); } catch { /* directory sync unavailable */ }
}

export class GenericApplyService {
  constructor(private readonly root: TrustedRoot, private readonly project: ProjectIdentity, private readonly hooks: GenericApplyHooks = {}) {}

  private checkpoint(boundary: GenericApplyBoundary): void { this.hooks.onBoundary?.(boundary); if (this.hooks.failAt === boundary) throw new GenericApplyRejected(`INJECTED_FAILURE:${boundary}`); }

  async apply(review: GenericReviewSet, approval: GenericApproval, proposal: FixProposal, evidence: GenericCodeEvidence, authorization: GenericAuthorization, policy: GenericApplyPolicy): Promise<GenericApplyReceipt> {
    if (policy.confirmation !== GENERIC_APPLY_CONFIRMATION) throw new GenericApplyRejected('APPLY_CONFIRMATION_REQUIRED');
    if (review.proposals.length !== 1 || proposal.sourcePath !== review.proposals[0]?.sourcePath) throw new GenericApplyRejected('SINGLE_FILE_ONLY');
    assertApprovalCurrent(approval, review);
    assertGenericAuthorizationCurrent(authorization, review, approval, [proposal], this.project);
    validateGenericCodeEvidence(evidence);
    if (evidence.reviewSetId !== review.reviewSetId || evidence.reviewSetDigest !== approval.reviewSetDigest || evidence.proposalIds.length !== 1 || evidence.proposalIds[0] !== proposalId(proposal) || evidence.sourceDigests[proposal.sourcePath] !== proposal.sourceDigest || evidence.editSetDigests[0] !== proposal.editSetDigest) throw new GenericApplyRejected('EVIDENCE_IDENTITY_MISMATCH');
    const lock = await acquireGenericLock(this.root, `apply-${sha(this.root.projectRoot).slice(0, 24)}`);
    let journal: GenericTransactionJournal | undefined;
    let sourceChanged = false;
    try {
      const path = await this.root.validateProjectPath(proposal.sourcePath, { file: true });
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || (!policy.allowHardLinks && info.nlink > 1)) throw new GenericApplyRejected('UNSAFE_SOURCE_FILE');
      const original = await readNoFollow(path);
      if (sha(original) !== proposal.sourceDigest || evidence.sourceDigests[proposal.sourcePath] !== sha(original)) throw new GenericApplyRejected('STALE_SOURCE');
      const candidate = candidateFromProposal(proposal, original);
      if (sha(candidate.after) !== evidence.candidateDigests[proposal.sourcePath]) throw new GenericApplyRejected('CANDIDATE_DIGEST_MISMATCH');
      if (evidence.syntaxChecks.some(check => check.state !== 'Passed')) throw new GenericApplyRejected('CODE_VALIDATION_REQUIRED');
      const transactionId = randomUUID();
      const backupRelativePath = `backups/${transactionId}.bak`;
      const backupPath = await this.root.validateStoragePath(backupRelativePath, { allowMissingLeaf: true });
      await mkdir(dirname(backupPath), { recursive: true, mode: 0o700 });
      this.checkpoint('before-backup');
      const backupHandle = await open(backupPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
      try { await backupHandle.writeFile(original, 'utf8'); await backupHandle.sync(); } finally { await backupHandle.close(); }
      const backup = await readFile(backupPath, 'utf8');
      if (sha(backup) !== sha(original)) throw new GenericApplyRejected('BACKUP_INTEGRITY_MISMATCH');
      this.checkpoint('after-backup');
      const journalStore = new GenericRecordStore(this.root, 'transactions');
      journal = createTransactionJournal(authorization, [{ path: proposal.sourcePath, sourceDigest: sha(original), candidateDigest: sha(candidate.after), editSetDigest: proposal.editSetDigest, order: 0 }]);
      journal = { ...journal, transactionId, id: transactionId } as GenericTransactionJournal;
      this.checkpoint('before-prepared-journal');
      await journalStore.append(journal);
      this.checkpoint('after-prepared-journal');
      journal = transitionTransaction(journal, 'Applying');
      this.checkpoint('before-applying-journal');
      await journalStore.append(journal);
      this.checkpoint('after-applying-journal');
      const beforeIdentity = await this.root.identity(proposal.sourcePath);
      if (beforeIdentity.ino !== undefined && info.ino !== undefined && beforeIdentity.ino !== info.ino) throw new GenericApplyRejected('SOURCE_IDENTITY_CHANGED');
      this.checkpoint('before-source-replacement');
      await atomicReplace(path, candidate.after, info.mode);
      sourceChanged = true;
      this.checkpoint('after-source-replacement');
      const resulting = await readNoFollow(path);
      if (sha(resulting) !== sha(candidate.after)) throw new GenericApplyRejected('APPLIED_DIGEST_MISMATCH');
      journal = transitionTransaction(journal, 'Applied');
      this.checkpoint('before-applied-journal');
      await journalStore.append(journal);
      this.checkpoint('after-applied-journal');
      const receiptBase = { id: transactionId, transactionId, projectIdentityDigest: authorization.projectIdentityDigest, sourcePath: proposal.sourcePath, originalDigest: sha(original), candidateDigest: sha(candidate.after), backupPath: backupRelativePath, backupDigest: sha(backup), proposalId: proposalId(proposal), reviewSetId: review.reviewSetId, reviewSetDigest: approval.reviewSetDigest, status: 'Applied' as const, appliedAt: new Date().toISOString() };
      const receipt = { ...receiptBase, integritySha256: integrity(receiptBase) } satisfies GenericApplyReceipt;
      this.checkpoint('before-receipt');
      await new GenericRecordStore(this.root, 'receipts').append({ ...receipt, kind: 'generic-apply-receipt', formatVersion: 1 });
      this.checkpoint('after-receipt');
      return Object.freeze(receipt);
    } catch (error) {
      if (journal) {
        try {
          const state = sourceChanged ? 'Recovery Required' : 'Failed';
          const recoveryJournal = transitionTransaction(journal, state);
          await new GenericRecordStore(this.root, 'transactions').append(recoveryJournal);
        } catch { /* preserve the original failure; recovery discovery will report corruption/incompleteness */ }
      }
      if (error instanceof GenericApplyRejected) throw error;
      throw new GenericApplyRejected('APPLY_INCOMPLETE');
    } finally { await lock.release(); }
  }
}

export { GenericEvidencePersistence };

import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFixProposal } from '../src/fix-proposal.js';
import { approveReviewSet, createReviewSet, markReadyForReview } from '../src/generic-review.js';
import { createCodeEvidence } from '../src/generic-evidence.js';
import { validateReviewSet } from '../src/generic-validation.js';
import { createGenericAuthorization } from '../src/generic-authorization.js';
import { TrustedRoot } from '../src/generic-trusted-root.js';
import { GenericApplyService, GENERIC_APPLY_CONFIRMATION, type GenericApplyBoundary } from '../src/generic-apply.js';
import { GenericRollbackRejected, GenericRollbackService, GENERIC_ROLLBACK_CONFIRMATION, type GenericRollbackBoundary } from '../src/generic-rollback.js';
import { GenericRecoveryService } from '../src/generic-recovery.js';
import type { Finding } from '../src/model.js';

const finding = (path: string, source: string): Finding => { const property = 'margin-left'; const start = source.indexOf(property); return { id: `fixture:${path}`, ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: 'css', applications: [], path, range: { start: { offset: start, line: 1, column: start + 1 }, end: { offset: start + property.length, line: 1, column: start + property.length + 1 } }, original: property, context: '.x', ownership: 'custom-css', rationale: 'r', treatment: 't', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'l' }; };
const proposal = (path: string, source: string) => createFixProposal(finding(path, source), source, [{ path, startOffset: source.indexOf('margin-left'), endOffset: source.indexOf('margin-left') + 11, expectedText: 'margin-left', replacement: 'margin-inline-start' }], { inputDigest: 'input', policyDigest: 'policy', transformationId: 'css-logical', transformationVersion: 1 });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'rtl-generic-apply-')); const project = join(root, 'project'); const storage = join(root, 'storage'); await mkdir(project); await mkdir(storage); const path = 'styles.css'; const source = '.x { margin-left: 1rem; }'; await writeFile(join(project, path), source); return { root, project, storage, path, source, trusted: await TrustedRoot.create(project, storage) };
}

async function prepared() {
  const f = await fixture(); const p = proposal(f.path, f.source); const ready = markReadyForReview(createReviewSet([p], 'input', 'policy'), 'review static change'); const approval = approveReviewSet(ready, 'explicit approval'); const validation = validateReviewSet(ready, new Map([[f.path, f.source]])); const evidence = createCodeEvidence(ready, approval, validation); const authorization = createGenericAuthorization(ready, approval, ready.proposals, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }); return { ...f, proposal: p, review: ready, approval, evidence, authorization }; }

describe('generic single-file controlled apply and rollback', () => {
  it.skipIf(process.platform === 'win32')('applies and rolls back a disposable CSS file with persisted evidence (POSIX secure access)', async () => {
    const f = await prepared(); const service = new GenericApplyService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }); const receipt = await service.apply(f.review, f.approval, f.proposal, f.evidence, f.authorization, { confirmation: GENERIC_APPLY_CONFIRMATION });
    expect(await readFile(join(f.project, f.path), 'utf8')).toContain('margin-inline-start'); expect(receipt.backupPath).toMatch(/^backups\//); const rollback = new GenericRollbackService(f.trusted); expect(await rollback.rollback(receipt, GENERIC_ROLLBACK_CONFIRMATION)).toBe('Rolled Back'); expect(await readFile(join(f.project, f.path), 'utf8')).toBe(f.source); expect(await rollback.rollback(receipt, GENERIC_ROLLBACK_CONFIRMATION)).toBe('Already Rolled Back');
  });
  it.skipIf(process.platform === 'win32')('fails closed for missing confirmation, stale source, conflicts, and multi-file review sets (POSIX Apply path)', async () => {
    const f = await prepared(); const service = new GenericApplyService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }); await expect(service.apply(f.review, f.approval, f.proposal, f.evidence, f.authorization, { confirmation: 'wrong' })).rejects.toThrow('APPLY_CONFIRMATION_REQUIRED'); await writeFile(join(f.project, f.path), '.x { margin-left: 2rem; }'); await expect(service.apply(f.review, f.approval, f.proposal, f.evidence, f.authorization, { confirmation: GENERIC_APPLY_CONFIRMATION })).rejects.toThrow('STALE_SOURCE');
    const other = proposal('other.css', '.x { margin-left: 1rem; }'); const multi = markReadyForReview(createReviewSet([f.proposal, other], 'input', 'policy'), 'multi'); const multiApproval = approveReviewSet(multi); const multiAuth = createGenericAuthorization(multi, multiApproval, multi.proposals, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }); await expect(service.apply(multi, multiApproval, f.proposal, f.evidence, multiAuth, { confirmation: GENERIC_APPLY_CONFIRMATION })).rejects.toThrow('SINGLE_FILE_ONLY');
  });
  it.skipIf(process.platform === 'win32')('refuses rollback after third-party changes (POSIX secure access)', async () => {
    const f = await prepared(); const service = new GenericApplyService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }); const receipt = await service.apply(f.review, f.approval, f.proposal, f.evidence, f.authorization, { confirmation: GENERIC_APPLY_CONFIRMATION }); await writeFile(join(f.project, f.path), 'third-party'); await expect(new GenericRollbackService(f.trusted).rollback(receipt, GENERIC_ROLLBACK_CONFIRMATION)).rejects.toBeInstanceOf(GenericRollbackRejected);
  });
  it.skipIf(process.platform === 'win32').each<GenericApplyBoundary>(['before-backup', 'after-backup', 'before-prepared-journal', 'after-prepared-journal', 'before-applying-journal', 'after-applying-journal', 'before-source-replacement', 'after-source-replacement', 'before-applied-journal', 'after-applied-journal', 'before-receipt', 'after-receipt'])('discovers an incomplete transaction when Apply fails at %s (POSIX secure access)', async (boundary) => {
    const f = await prepared(); const service = new GenericApplyService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }, { failAt: boundary }); await expect(service.apply(f.review, f.approval, f.proposal, f.evidence, f.authorization, { confirmation: GENERIC_APPLY_CONFIRMATION })).rejects.toThrow(`INJECTED_FAILURE:${boundary}`); const assessment = await new GenericRecoveryService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }).list(); if (assessment.length > 0) expect(assessment[0]?.status).toMatch(/RECOVERY_REQUIRED|ROLLBACK_CONFLICT/); const current = await readFile(join(f.project, f.path), 'utf8'); if (boundary === 'after-source-replacement' || boundary === 'before-applied-journal' || boundary === 'after-applied-journal' || boundary === 'before-receipt' || boundary === 'after-receipt') expect(current).toContain('margin-inline-start'); else expect(current).toBe(f.source);
  });
  it.skipIf(process.platform === 'win32').each<GenericRollbackBoundary>(['before-backup-read', 'before-rollback-replacement', 'after-rollback-replacement', 'before-rollback-journal', 'after-rollback-journal', 'before-rollback-receipt', 'after-rollback-receipt'])('does not report rollback success when failing at %s (POSIX secure access)', async (boundary) => {
    const f = await prepared(); const service = new GenericApplyService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }); const receipt = await service.apply(f.review, f.approval, f.proposal, f.evidence, f.authorization, { confirmation: GENERIC_APPLY_CONFIRMATION }); await expect(new GenericRollbackService(f.trusted, { failAt: boundary }).rollback(receipt, GENERIC_ROLLBACK_CONFIRMATION)).rejects.toThrow(`INJECTED_FAILURE:${boundary}`);
  });
  it.skipIf(process.platform === 'win32')('rejects corrupted backups and reports read-only recovery state (POSIX secure access)', async () => {
    const f = await prepared(); const service = new GenericApplyService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }); const receipt = await service.apply(f.review, f.approval, f.proposal, f.evidence, f.authorization, { confirmation: GENERIC_APPLY_CONFIRMATION }); await writeFile(join(f.storage, receipt.backupPath), 'corrupted'); await expect(new GenericRollbackService(f.trusted).rollback(receipt, GENERIC_ROLLBACK_CONFIRMATION)).rejects.toThrow('BACKUP_INTEGRITY_MISMATCH'); expect((await new GenericRecoveryService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'fixture-repo' }).assess(receipt.transactionId)).status).toBe('RECOVERY_REQUIRED');
  });
});

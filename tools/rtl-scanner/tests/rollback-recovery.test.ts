import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { ApplyAuditStore, ControlledApplyService, APPLY_CONFIRMATION } from '../src/controlled-apply.js';
import { REVIEW_SOURCE, type PatchRequest, type ReviewRecord } from '../src/review-session.js';
import { evidenceIntegrity, type EvidenceSnapshot } from '../src/evidence-store.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const identity = { findingId: 'RTL.BIDI.ISOLATION:741d2ce2aec3a86cf2db37ea', sourcePath: REVIEW_SOURCE, inputDigest: 'input', policyDigest: 'policy', schemaVersion: 2 };

it('recovers an eligible rollback receipt from durable audit state and rejects it after rollback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rtl-rollback-recovery-')); await mkdir(join(root, 'apps/invoicing/src/components'), { recursive: true });
  const original = 'const value = {i.id};\n'; const source = join(root, REVIEW_SOURCE); await writeFile(source, original); const patch: PatchRequest = { findingId: identity.findingId, path: REVIEW_SOURCE, startOffset: 14, endOffset: 20, expectedSha256: hash('{i.id}'), replacement: '<bdi dir="auto">{i.id}</bdi>' }; const candidate = original.slice(0, patch.startOffset) + patch.replacement + original.slice(patch.endOffset);
  const payload = { ...identity, candidatePatchIdentity: { path: REVIEW_SOURCE, expectedSha256: patch.expectedSha256, replacementSha256: hash(patch.replacement) }, originalSourceSha256: hash(original), candidateSourceSha256: hash(candidate), codeDiff: '- old\n+ new', scannerBefore: { findingPresent: true, resultDigest: hash('before') }, scannerAfter: { findingPresent: false, resultDigest: hash('after') }, browserDomValidation: ['original-ltr:html.dir=ltr'], screenshotReferences: [], timestamp: new Date().toISOString(), decision: 'Approved' as const, patch, snapshotId: 'snapshot' }; const evidence = { ...payload, integritySha256: evidenceIntegrity(payload) } as EvidenceSnapshot; const reviewRecord = { ...identity, status: 'Approved' as const, reviewerNotes: 'approved', evidenceReferences: ['snapshot'], timestamp: new Date().toISOString() } as ReviewRecord; const service = new ControlledApplyService(root, new ApplyAuditStore(join(root, 'audit.json')), join(root, 'backups'));
  try { const receipt = await service.apply({ identity, reviewRecord, evidence: [evidence], patch, confirmation: APPLY_CONFIRMATION }); const recovered = await service.recoverRollbackReceipt(REVIEW_SOURCE, evidence.originalSourceSha256, evidence.candidateSourceSha256); expect(recovered).toMatchObject({ auditId: receipt.auditId, appliedSha256: receipt.appliedSha256 }); await service.rollback(receipt); expect(await service.recoverRollbackReceipt(REVIEW_SOURCE, evidence.originalSourceSha256, evidence.candidateSourceSha256)).toBeNull(); } finally { await rm(root, { recursive: true, force: true }); }
});

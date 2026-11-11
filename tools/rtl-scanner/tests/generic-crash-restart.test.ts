import { describe, expect, it } from 'vitest';
import { fork, spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFixProposal } from '../src/fix-proposal.js';
import { approveReviewSet, createReviewSet, markReadyForReview } from '../src/generic-review.js';
import { createCodeEvidence } from '../src/generic-evidence.js';
import { validateReviewSet } from '../src/generic-validation.js';
import { createGenericAuthorization } from '../src/generic-authorization.js';
import { TrustedRoot } from '../src/generic-trusted-root.js';
import { GenericApplyService, GENERIC_APPLY_CONFIRMATION } from '../src/generic-apply.js';
import { GenericRollbackService, GENERIC_ROLLBACK_CONFIRMATION } from '../src/generic-rollback.js';
import type { Finding } from '../src/model.js';

const worker = join(process.cwd(), 'tools/rtl-scanner/tests/fixtures/generic-crash-worker.mjs');
const finding = (path: string, source: string): Finding => { const property = 'margin-left'; const start = source.indexOf(property); return { id: `crash:${path}`, ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: 'css', applications: [], path, range: { start: { offset: start, line: 1, column: start + 1 }, end: { offset: start + property.length, line: 1, column: start + property.length + 1 } }, original: property, context: '.x', ownership: 'custom-css', rationale: 'r', treatment: 't', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'l' }; };
const proposalFor = (path: string, source: string) => createFixProposal(finding(path, source), source, [{ path, startOffset: source.indexOf('margin-left'), endOffset: source.indexOf('margin-left') + 11, expectedText: 'margin-left', replacement: 'margin-inline-start' }], { inputDigest: 'input', policyDigest: 'policy', transformationId: 'crash-test', transformationVersion: 1 });

async function prepared() { const root = await mkdtemp(join(tmpdir(), 'rtl-crash-restart-')); const projectRoot = join(root, 'project'); const storageRoot = join(root, 'storage'); await mkdir(projectRoot); await mkdir(storageRoot); const source = '.x { margin-left: 1rem; }'; const sourcePath = 'styles.css'; await writeFile(join(projectRoot, sourcePath), source); const trusted = await TrustedRoot.create(projectRoot, storageRoot); const proposal = proposalFor(sourcePath, source); const review = markReadyForReview(createReviewSet([proposal], 'input', 'policy'), 'crash review'); const approval = approveReviewSet(review); const evidence = createCodeEvidence(review, approval, validateReviewSet(review, new Map([[sourcePath, source]]))); const authorization = createGenericAuthorization(review, approval, review.proposals, { canonicalRoot: trusted.projectRoot, repositoryIdentity: 'crash-fixture' }); return { root, projectRoot, storageRoot, sourcePath, source, trusted, proposal, review, approval, evidence, authorization }; }

async function killAt(payload: object, boundary: string): Promise<void> {
  const payloadPath = join((payload as { storageRoot: string }).storageRoot, `worker-${boundary}.json`); await writeFile(payloadPath, `${JSON.stringify(payload)}\n`); const child = fork(worker, [payloadPath], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }); let stderr = ''; child.stderr?.on('data', chunk => { stderr += String(chunk); }); await new Promise<void>((resolve, reject) => { const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`BOUNDARY_TIMEOUT:${boundary}:${stderr}`)); }, 5000); child.on('message', message => { if ((message as { type?: string; boundary?: string }).type === 'boundary' && (message as { boundary?: string }).boundary === boundary) { clearTimeout(timer); child.kill('SIGKILL'); } }); child.on('exit', (_code, signal) => { if (signal === 'SIGKILL') resolve(); else reject(new Error(`UNEXPECTED_CHILD_EXIT:${String(signal)}:${stderr}`)); }); child.on('error', reject); }); }

async function recover(payload: { projectRoot: string; storageRoot: string; repositoryIdentity: string; transactionId: string }): Promise<Record<string, unknown>> {
  const path = join(payload.storageRoot, 'recover.json'); await writeFile(path, `${JSON.stringify({ ...payload, mode: 'recover' })}\n`); return new Promise((resolve, reject) => { const child = spawn(process.execPath, [worker, path], { stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; let error = ''; child.stdout.on('data', chunk => { output += String(chunk); }); child.stderr.on('data', chunk => { error += String(chunk); }); child.on('error', reject); child.on('close', code => { if (code !== 0) reject(new Error(error || `RECOVERY_EXIT:${code}`)); else resolve(JSON.parse(output)); }); }); }

describe('generic real process crash and restart verification', () => {
  it('discovers Apply interrupted after source replacement in a fresh process', async () => {
    const f = await prepared(); await killAt({ mode: 'apply', projectRoot: f.projectRoot, storageRoot: f.storageRoot, repositoryIdentity: 'crash-fixture', review: f.review, approval: f.approval, proposal: f.proposal, evidence: f.evidence, authorization: f.authorization }, 'after-source-replacement'); const current = await readFile(join(f.projectRoot, f.sourcePath), 'utf8'); expect(current).toContain('margin-inline-start'); const { GenericRecordStore } = await import('../src/generic-persistence.js'); const journals = await new GenericRecordStore(f.trusted, 'transactions').list(); const transactionId = String((journals[0] as unknown as { transactionId: string }).transactionId); const assessment = await recover({ projectRoot: f.projectRoot, storageRoot: f.storageRoot, repositoryIdentity: 'crash-fixture', transactionId }); expect(assessment.status).toBe('RECOVERY_REQUIRED'); expect(assessment.receiptPresent).toBe(false);
  });
  it('discovers Rollback interrupted after restoration in a fresh process', async () => {
    const f = await prepared(); const receipt = await new GenericApplyService(f.trusted, { canonicalRoot: f.trusted.projectRoot, repositoryIdentity: 'crash-fixture' }).apply(f.review, f.approval, f.proposal, f.evidence, f.authorization, { confirmation: GENERIC_APPLY_CONFIRMATION }); await killAt({ mode: 'rollback', projectRoot: f.projectRoot, storageRoot: f.storageRoot, repositoryIdentity: 'crash-fixture', receipt }, 'after-rollback-replacement'); expect(await readFile(join(f.projectRoot, f.sourcePath), 'utf8')).toBe(f.source); const assessment = await recover({ projectRoot: f.projectRoot, storageRoot: f.storageRoot, repositoryIdentity: 'crash-fixture', transactionId: receipt.transactionId }); expect(assessment.status).toBe('RECOVERY_REQUIRED');
  });
  it('keeps stale locks fail-closed after child termination', async () => {
    const f = await prepared(); await killAt({ mode: 'lock', projectRoot: f.projectRoot, storageRoot: f.storageRoot, repositoryIdentity: 'crash-fixture', name: 'apply-stale' }, 'lock-acquired');
    const { acquireGenericLock } = await import('../src/generic-lock.js'); await expect(acquireGenericLock(f.trusted, 'apply-stale')).rejects.toThrow('LOCK_CONFLICT');
  });
});

import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, symlink, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createFixProposal } from '../src/fix-proposal.js';
import { approveReviewSet, createReviewSet, markReadyForReview } from '../src/generic-review.js';
import { createCodeEvidence } from '../src/generic-evidence.js';
import { validateReviewSet } from '../src/generic-validation.js';
import { createGenericAuthorization } from '../src/generic-authorization.js';
import type { Finding } from '../src/model.js';
import { TrustedRoot } from '../src/generic-trusted-root.js';
import { GenericApplyService } from '../src/generic-apply.js';
import { GenericMultiFileApplyService, GenericMultiFileRollbackService } from '../src/generic-multi-file-transaction.js';
import { GenericRollbackService, GENERIC_ROLLBACK_CONFIRMATION } from '../src/generic-rollback.js';
import { GenericRecordStore, createPersistedRecord } from '../src/generic-persistence.js';
import { ControlledApplyService, ApplyAuditStore } from '../src/controlled-apply.js';
import { assertSecureFileAccessSupported, UNSUPPORTED_SECURE_FILE_ACCESS } from '../src/secure-file-access.js';
import { extractSourceSnippets } from '../src/source-snippets.js';
import { discover } from '../src/discovery.js';
import { publishReports } from '../src/report-publisher.js';
import { ReviewRecordStore } from '../src/review-store.js';

describe('Windows secure-access transaction contract', () => {
  it('rejects protected entry points before filesystem mutation', async () => {
    if (process.platform !== 'win32') return;
    expect(() => assertSecureFileAccessSupported()).toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    const root = await mkdtemp(join(tmpdir(), 'rtl-win-contract-'));
    const project = join(root, 'project'); const storage = join(root, 'storage');
    await mkdir(project); await mkdir(storage); await writeFile(join(project, 'a.css'), '.a{}');
    const trusted = await TrustedRoot.create(project, storage);
    const before = await readFile(join(project, 'a.css'), 'utf8');
    await expect(new GenericApplyService(trusted, { canonicalRoot: project }).apply({} as never, {} as never, {} as never, {} as never, {} as never, {} as never)).rejects.toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    await expect(new GenericMultiFileApplyService(trusted, { canonicalRoot: project }).apply({} as never, {} as never, [], {} as never, {} as never, {} as never)).rejects.toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    await expect(new GenericMultiFileRollbackService(trusted, { canonicalRoot: project }).rollback({} as never, 'confirmed')).rejects.toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    await expect(new ControlledApplyService(project, new ApplyAuditStore(join(root, 'audit.json')), join(storage, 'backups')).apply({} as never)).rejects.toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    expect(await readFile(join(project, 'a.css'), 'utf8')).toBe(before);
    expect(await readdir(storage)).toEqual([]);
  });

  it('rejects a valid single-file Apply before mutation', async () => {
    if (process.platform !== 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'rtl-win-single-apply-')); const project = join(root, 'project'); const storage = join(root, 'storage');
    await mkdir(project); await mkdir(storage); const source = '.x { margin-left: 1rem; }'; const path = 'styles.css'; await writeFile(join(project, path), source); await writeFile(join(project, 'unrelated.txt'), 'unchanged'); await writeFile(join(storage, 'sentinel.txt'), 'unchanged');
    const trusted = await TrustedRoot.create(project, storage); const original = 'margin-left'; const offset = source.indexOf(original);
    const finding: Finding = { id: 'single:styles.css', ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: 'css', applications: [], path, range: { start: { offset, line: 1, column: offset + 1 }, end: { offset: offset + original.length, line: 1, column: offset + original.length + 1 } }, original, context: '.x', ownership: 'custom-css', rationale: 'r', treatment: 't', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'l' };
    const proposal = createFixProposal(finding, source, [{ path, startOffset: offset, endOffset: offset + original.length, expectedText: original, replacement: 'margin-inline-start' }], { inputDigest: 'input', policyDigest: 'policy', transformationId: 'single-css', transformationVersion: 1 });
    const review = markReadyForReview(createReviewSet([proposal], 'input', 'policy'), 'single'); const approval = approveReviewSet(review); const validation = validateReviewSet(review, new Map([[path, source]])); expect(validation.state).toBe('Passed'); const evidence = createCodeEvidence(review, approval, validation); const authorization = createGenericAuthorization(review, approval, review.proposals, { canonicalRoot: trusted.projectRoot, repositoryIdentity: 'single' });
    const beforeStorage = await readdir(storage); const service = new GenericApplyService(trusted, { canonicalRoot: trusted.projectRoot, repositoryIdentity: 'single' });
    for (let attempt = 0; attempt < 2; attempt += 1) await expect(service.apply(review, approval, proposal, evidence, authorization, { confirmation: 'GENERIC_APPLY_CONFIRMED' })).rejects.toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    expect(await readFile(join(project, path), 'utf8')).toBe(source); expect(await readFile(join(project, 'unrelated.txt'), 'utf8')).toBe('unchanged'); expect(await readdir(storage)).toEqual(beforeStorage);
  });

  it('rejects valid single-file Rollback before mutation', async () => {
    if (process.platform !== 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'rtl-win-single-rollback-')); const project = join(root, 'project'); const storage = join(root, 'storage'); const records = join(storage, 'records'); const backups = join(storage, 'backups');
    await mkdir(storage);
    await mkdir(project); await mkdir(records); await mkdir(backups); const original = '.x { margin-left: 1rem; }'; const candidate = '.x { margin-inline-start: 1rem; }'; const path = 'styles.css'; await writeFile(join(project, path), candidate); const backupPath = 'backups/tx-original.css'; await writeFile(join(storage, backupPath), original); const trusted = await TrustedRoot.create(project, storage); const sha = (value: string) => createHash('sha256').update(value).digest('hex'); const transactionId = 'tx-single-rollback';
    const lockPath = join(storage, 'locks', `apply-${sha(trusted.projectRoot).slice(0, 24)}.lock`); await mkdir(lockPath, { recursive: true }); await writeFile(join(lockPath, 'owner.json'), '{"token":"sentinel","pid":0,"acquiredAt":"1970-01-01T00:00:00.000Z"}\n');
    const receipt = { id: transactionId, kind: 'generic-apply-receipt', formatVersion: 1, transactionId, sourcePath: path, backupPath, originalDigest: sha(original), candidateDigest: sha(candidate), backupDigest: sha(original), status: 'Applied', repositoryIdentity: 'single', createdAt: new Date(0).toISOString() };
    await new GenericRecordStore(trusted, 'transactions').append(createPersistedRecord({ ...receipt, integritySha256: undefined } as never) as never);
    const beforeSource = await readFile(join(project, path), 'utf8'); const beforeStorage = await readdir(storage, { recursive: true });
    const service = new GenericRollbackService(trusted); for (let attempt = 0; attempt < 2; attempt += 1) await expect(service.rollback(receipt as never, GENERIC_ROLLBACK_CONFIRMATION)).rejects.toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    expect(await readFile(join(project, path), 'utf8')).toBe(beforeSource); expect(await readdir(storage, { recursive: true })).toEqual(beforeStorage);
  });

  it('rejects the exact three-file preflight before any transaction mutation', async () => {
    if (process.platform !== 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'rtl-win-three-contract-'));
    const project = join(root, 'project'); const storage = join(root, 'storage');
    await mkdir(join(project, 'src'), { recursive: true }); await mkdir(storage);
    const sources = new Map([['src/a.css', '.a { margin-left: 1px; }'], ['src/b.css', '.b { margin-left: 2px; }'], ['src/c.css', '.c { margin-left: 3px; }']]);
    for (const [path, source] of sources) await writeFile(join(project, path), source);
    await writeFile(join(project, 'unrelated.txt'), 'unchanged'); await writeFile(join(storage, 'sentinel.txt'), 'unchanged');
    const trusted = await TrustedRoot.create(project, storage);
    const proposals = [...sources].map(([path, source]) => {
      const original = 'margin-left'; const offset = source.indexOf(original);
      const finding: Finding = { id: `three:${path}`, ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: 'css', applications: [], path, range: { start: { offset, line: 1, column: offset + 1 }, end: { offset: offset + original.length, line: 1, column: offset + original.length + 1 } }, original, context: '.x', ownership: 'custom-css', rationale: 'r', treatment: 't', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'l' };
      return createFixProposal(finding, source, [{ path, startOffset: offset, endOffset: offset + original.length, expectedText: original, replacement: 'margin-inline-start' }], { inputDigest: 'input', policyDigest: 'policy', transformationId: 'three-css', transformationVersion: 1 });
    });
    const review = markReadyForReview(createReviewSet(proposals, 'input', 'policy'), 'three');
    const approval = approveReviewSet(review);
    const validation = validateReviewSet(review, sources);
    expect(validation.state).toBe('Passed'); expect(validation.originalSources).toEqual(sources); expect(validation.candidateSources.size).toBe(3);
    const evidence = createCodeEvidence(review, approval, validation);
    const authorization = createGenericAuthorization(review, approval, review.proposals, { canonicalRoot: trusted.projectRoot, repositoryIdentity: 'three' });
    expect(review.proposals).toHaveLength(3); expect(authorization).toBeDefined();
    const beforeFiles = await Promise.all([...sources].map(async ([path, source]) => [path, await readFile(join(project, path), 'utf8'), source] as const));
    const beforeStorage = await readdir(storage);
    const service = new GenericMultiFileApplyService(trusted, { canonicalRoot: trusted.projectRoot, repositoryIdentity: 'three' });
    for (let attempt = 0; attempt < 2; attempt += 1) await expect(service.apply(review, approval, review.proposals, evidence, authorization, { confirmation: 'APPLY_MULTI_FILE_CONFIRMED' })).rejects.toThrow(UNSUPPORTED_SECURE_FILE_ACCESS);
    for (const [path, before, original] of beforeFiles) { expect(await readFile(join(project, path), 'utf8')).toBe(before); expect(before).toBe(original); }
    expect(await readFile(join(project, 'unrelated.txt'), 'utf8')).toBe('unchanged'); expect(await readdir(storage)).toEqual(beforeStorage);
  });

  it('fails closed for valid source snippets when no-follow access is unavailable', async () => {
    if (process.platform !== 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'rtl-win-snippet-contract-')); const source = 'first line\nrecognizable secure content\nlast line\n'; const path = 'styles.css';
    await writeFile(join(root, path), source);
    const start = source.indexOf('recognizable'); const makeFinding = (findingPath: string): Finding => ({ id: `snippet:${findingPath}`, ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: 'css', applications: [], path: findingPath, range: { start: { offset: start, line: 2, column: 1 }, end: { offset: start + 'recognizable'.length, line: 2, column: 13 } }, original: 'recognizable', context: 'secure', ownership: 'custom-css', rationale: 'r', treatment: 't', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'l' });
    const valid = makeFinding(path); const first = await extractSourceSnippets(root, [valid]); const second = await extractSourceSnippets(root, [valid]);
    expect(first.findings).toEqual([{ findingId: valid.id, available: false, reason: 'UNSUPPORTED_NOFOLLOW' }]); expect(second.findings).toEqual(first.findings); expect(first.sources).toEqual([]); expect(first.embeddedBytes).toBe(0); expect(first.sourceTextByPath).toEqual({}); expect(JSON.stringify(first)).not.toContain(source); expect(JSON.stringify(first)).not.toContain('recognizable secure content');
    const invalid = await extractSourceSnippets(root, [makeFinding('../outside.css')]); expect(invalid.findings).toEqual([{ findingId: 'snippet:../outside.css', available: false, reason: 'INVALID_PATH' }]);
  });

  it('does not traverse a Windows directory junction during discovery', async () => {
    if (process.platform !== 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'rtl-win-discovery-junction-')); const target = join(root, 'target'); const link = join(root, 'linked-dir');
    await mkdir(target); await writeFile(join(target, 'hidden.ts'), 'export const hidden = true;'); await writeFile(join(root, 'legitimate.ts'), 'export const legitimate = true;'); await symlink(target, link, 'junction');
    try { const first = await discover(root); const second = await discover(root); expect(first).toEqual(second); expect(first.files).toContain('legitimate.ts'); expect(first.files.some(file => file.includes('linked-dir'))).toBe(false); expect(first.skipped).toContain('linked-dir'); } finally { await rm(link, { force: true }); await rm(root, { recursive: true, force: true }); }
  });

  it('rejects junction output publication without touching its target', async () => {
    if (process.platform !== 'win32') return;
    const base = await mkdtemp(join(tmpdir(), 'rtl-win-publisher-junction-')); const root = join(base, 'scan-root'); const target = join(base, 'target'); const link = join(base, 'linked-output');
    await mkdir(root); await mkdir(target); await writeFile(join(target, 'sentinel.txt'), 'unchanged'); await symlink(target, link, 'junction');
    try { await expect(publishReports(root, link, 'json\n', 'markdown\n')).rejects.toThrow(/non-symlink directories/); expect(await readFile(join(target, 'sentinel.txt'), 'utf8')).toBe('unchanged'); expect(await readdir(target)).toEqual(['sentinel.txt']); } finally { await rm(link, { force: true }); await rm(base, { recursive: true, force: true }); }
  });

  it('rejects a junction review-store ancestor before persistence', async () => {
    if (process.platform !== 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'rtl-win-review-store-junction-')); const target = join(root, 'target'); const link = join(root, 'linked-store');
    await mkdir(target); await writeFile(join(target, 'sentinel.txt'), 'unchanged'); await symlink(target, link, 'junction');
    try { const store = new ReviewRecordStore(join(link, 'review-records-v1.json')); await expect(store.load()).rejects.toThrow('REVIEW_STORE_SYMLINK'); expect(await readFile(join(target, 'sentinel.txt'), 'utf8')).toBe('unchanged'); expect(await readdir(target)).toEqual(['sentinel.txt']); } finally { await rm(link, { force: true }); await rm(root, { recursive: true, force: true }); }
  });

  it('rejects a junction source ancestor before exposing snippets', async () => {
    if (process.platform !== 'win32') return;
    const root = await mkdtemp(join(tmpdir(), 'rtl-win-snippet-junction-')); const target = join(root, 'target'); const link = join(root, 'linked-src'); const source = 'margin-left';
    await mkdir(target); await writeFile(join(target, 'styles.css'), source); await symlink(target, link, 'junction');
    const finding: Finding = { id: 'junction-snippet', ruleId: 'R1', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'fixture', sourceMechanism: 'css', applications: [], path: 'styles.css', range: { start: { offset: 0, line: 1, column: 1 }, end: { offset: source.length, line: 1, column: source.length + 1 } }, original: source, context: 'fixture', ownership: 'fixture', rationale: 'fixture', treatment: 'review', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'fixture' };
    try { const result = await extractSourceSnippets(link, [finding]); expect(result.findings).toEqual([{ findingId: finding.id, available: false, reason: 'SYMLINK' }]); expect(result.sources).toEqual([]); expect(JSON.stringify(result)).not.toContain(source); expect(await readFile(join(target, 'styles.css'), 'utf8')).toBe(source); } finally { await rm(link, { force: true }); await rm(root, { recursive: true, force: true }); }
  });
});

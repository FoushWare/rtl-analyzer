import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { applyReviewPatch, assertPortAvailable, clearReviewRecords, createReviewSession, getReviewRecord, REVIEW_FINDING_ID, REVIEW_SOURCE, runtimeCacheDir, saveReviewRecord, validatePatch, validateReviewIdentity, validateReviewPath } from '../src/review-session.js';
import { recoverCandidateSessionId } from '../src/review-approval.js';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

describe('review session isolation', () => {
  const identity = { findingId: REVIEW_FINDING_ID, sourcePath: REVIEW_SOURCE, inputDigest: 'input-a', policyDigest: 'policy-a', schemaVersion: 2 };
  it('stores independent review records and rejects stale identities', () => {
    clearReviewRecords();
    const record = saveReviewRecord({ ...identity, status: 'Needs Manual Investigation', reviewerNotes: 'No safe fix established.', evidenceReferences: ['source:78'] });
    expect(getReviewRecord(identity)).toMatchObject({ status: 'Needs Manual Investigation', reviewerNotes: 'No safe fix established.' });
    expect(getReviewRecord({ ...identity, inputDigest: 'input-b' })).toBeNull();
    const third = { ...identity, findingId: 'RTL.CSS.PHYSICAL:third-independent-finding' };
    expect(() => validateReviewIdentity(third)).not.toThrow();
    expect(() => validateReviewIdentity({ ...identity, findingId: '' })).toThrow('INVALID_REVIEW_IDENTITY');
    expect(record.timestamp).toBeTruthy();
  });
  it('validates review state transitions independently of scanner fields', () => {
    clearReviewRecords();
    saveReviewRecord({ ...identity, status: 'Needs Manual Investigation', reviewerNotes: '', evidenceReferences: [] });
    expect(() => saveReviewRecord({ ...identity, status: 'Approved', reviewerNotes: '', evidenceReferences: [] })).toThrow('INVALID_REVIEW_TRANSITION');
    saveReviewRecord({ ...identity, status: 'Verified Correct', reviewerNotes: 'Confirmed intended Arabic back affordance.', evidenceReferences: ['manual:design-review'] });
    expect(getReviewRecord(identity)?.status).toBe('Verified Correct');
  });
  it('allows a proposed candidate to become reviewable only through the legal evidence-backed path', () => {
    clearReviewRecords();
    saveReviewRecord({ ...identity, status: 'Candidate Proposed', reviewerNotes: '', evidenceReferences: [], candidateSessionId: 'candidate-1' });
    expect(() => saveReviewRecord({ ...identity, status: 'Approved', reviewerNotes: 'approved without review', evidenceReferences: ['evidence-1'], candidateSessionId: 'candidate-1' })).toThrow('INVALID_REVIEW_TRANSITION');
    saveReviewRecord({ ...identity, status: 'Ready for Review', reviewerNotes: 'Validated candidate is ready for review.', evidenceReferences: ['evidence-1'], candidateSessionId: 'candidate-1' });
    expect(getReviewRecord(identity)?.status).toBe('Ready for Review');
  });
  it('recovers only the persisted candidate session for approval after reload', () => {
    expect(recoverCandidateSessionId({}, { candidateSessionId: 'candidate-1' })).toBe('candidate-1');
    expect(() => recoverCandidateSessionId({ candidateSessionId: 'candidate-2' }, { candidateSessionId: 'candidate-1' })).toThrow('CANDIDATE_SESSION_MISMATCH');
    expect(() => recoverCandidateSessionId({}, null)).toThrow('HEALTHY_CANDIDATE_REQUIRED');
  });
  it('derives independent original and candidate Vite cache directories', () => {
    expect(runtimeCacheDir('/tmp/fixture-a', 'original')).not.toBe(runtimeCacheDir('/tmp/fixture-a', 'candidate'));
    expect(runtimeCacheDir('/tmp/fixture-a', 'original')).not.toBe(runtimeCacheDir('/tmp/fixture-b', 'original'));
  });
  it('rejects an occupied candidate port instead of reusing it', async () => {
    const server = createServer((_request, response) => { response.statusCode = 200; response.end('unrelated'); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('TEST_PORT_UNAVAILABLE');
    await expect(assertPortAvailable(address.port)).rejects.toThrow('CANDIDATE_PORT_OCCUPIED');
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  it('accepts only the approved source and rejects traversal', () => {
    expect(() => validateReviewPath('/tmp/repo', REVIEW_SOURCE)).not.toThrow();
    expect(() => validateReviewPath('/tmp/repo', '../secret.ts')).toThrow('INVALID_REVIEW_PATH');
    expect(() => validateReviewPath('/tmp/repo', 'apps/other.tsx')).toThrow('REVIEW_SOURCE_NOT_ALLOWED');
  });
  it('rejects stale or out-of-range patches', () => {
    const text = 'abcdef';
    expect(() => validatePatch(text, { findingId: REVIEW_FINDING_ID, path: REVIEW_SOURCE, startOffset: 1, endOffset: 4, expectedSha256: sha('xxx'), replacement: 'X' })).toThrow('STALE_REVIEW_SOURCE');
    expect(() => validatePatch(text, { findingId: REVIEW_FINDING_ID, path: REVIEW_SOURCE, startOffset: 2, endOffset: 1, expectedSha256: sha(''), replacement: 'X' })).toThrow('INVALID_REVIEW_RANGE');
  });
  it('copies dirty source and applies a patch without changing the original', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-review-test-'));
    try {
      const source = join(root, REVIEW_SOURCE);
      await (await import('node:fs/promises')).mkdir(join(root, 'apps/invoicing/src/components'), { recursive: true });
      await writeFile(source, 'const original = true;\n');
      const session = await createReviewSession(root);
      const original = await readFile(source, 'utf8');
      const next = await applyReviewPatch(session, { findingId: REVIEW_FINDING_ID, path: REVIEW_SOURCE, startOffset: 6, endOffset: 14, expectedSha256: sha('original'), replacement: 'changed' });
      expect(await readFile(source, 'utf8')).toBe(original);
      expect(await readFile(join(next.candidateRoot, REVIEW_SOURCE), 'utf8')).toBe('const changed = true;\n');
      await (await import('../src/review-session.js')).disposeReviewSession(next);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('rejects symlinked source files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-review-link-'));
    try { await (await import('node:fs/promises')).mkdir(join(root, 'apps/invoicing/src/components'), { recursive: true }); await writeFile(join(root, 'real.tsx'), 'x'); await symlink(join(root, 'real.tsx'), join(root, REVIEW_SOURCE)); await expect(createReviewSession(root)).rejects.toThrow('REVIEW_SOURCE_NOT_REGULAR_FILE'); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
});

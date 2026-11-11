import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TrustedRoot } from '../src/generic-trusted-root.js';
import { acquireGenericLock } from '../src/generic-lock.js';
import { GenericRecordStore, createPersistedRecord } from '../src/generic-persistence.js';
import { createFixProposal } from '../src/fix-proposal.js';
import { approveReviewSet, createReviewSet, markReadyForReview } from '../src/generic-review.js';
import { createGenericAuthorization, assertGenericAuthorizationCurrent } from '../src/generic-authorization.js';
import { createTransactionJournal, transitionTransaction } from '../src/generic-transaction-journal.js';
import type { Finding } from '../src/model.js';

const makeProposal = (path: string, source: string) => {
  const property = 'margin-left';
  const start = source.indexOf(property);
  const finding: Finding = { id: `f:${path}`, ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: 'css', applications: [], path, range: { start: { offset: start, line: 1, column: start + 1 }, end: { offset: start + property.length, line: 1, column: start + property.length + 1 } }, original: property, context: '.x', ownership: 'custom-css', rationale: 'r', treatment: 't', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'l' };
  return createFixProposal(finding, source, [{ path, startOffset: start, endOffset: start + property.length, expectedText: property, replacement: 'margin-inline-start' }], { inputDigest: 'input', policyDigest: 'policy', transformationId: 'css-logical', transformationVersion: 1 });
};

async function roots() { const root = await mkdtemp(join(tmpdir(), 'rtl-generic-security-')); const project = join(root, 'project'); const storage = join(root, 'storage'); await mkdir(project); await mkdir(storage); return { root, trusted: await TrustedRoot.create(project, storage) }; }

describe('generic security foundation', () => {
  it('rejects traversal, absolute paths, and symlinked project ancestors', async () => {
    const { root, trusted } = await roots();
    await expect(trusted.validateProjectPath('../outside')).rejects.toThrow('PROJECT_PATH_REJECTED');
    await expect(trusted.validateProjectPath(join(root, 'outside'))).rejects.toThrow('PROJECT_PATH_REJECTED');
    await symlink(trusted.projectRoot, join(root, 'link'));
    await expect(TrustedRoot.create(join(root, 'link'), trusted.storageRoot)).rejects.toThrow('SYMLINK_ROOT_REJECTED');
  });
  it('provides cross-process-style exclusive lock ownership', async () => {
    const { trusted } = await roots();
    const first = await acquireGenericLock(trusted, 'test');
    await expect(acquireGenericLock(trusted, 'test')).rejects.toThrow('LOCK_CONFLICT');
    await first.release();
    const second = await acquireGenericLock(trusted, 'test');
    await second.release();
  });
  it('persists deterministic integrity-checked records and rejects tampering', async () => {
    const { trusted } = await roots();
    const store = new GenericRecordStore(trusted, 'authorization');
    const record = createPersistedRecord({ id: 'a', kind: 'generic-authorization', formatVersion: 1, value: 'safe' });
    await store.append(record);
    expect((await store.list()).map(item => item.id)).toEqual(['a']);
    await writeFile(join(trusted.storageRoot, 'records/authorization.json'), '{"formatVersion":1,"records":[{"id":"a"}]}');
    await expect(store.list()).rejects.toThrow('RECORD_INTEGRITY_MISMATCH');
  });
  it('binds authorization to project identity and journals only valid transitions', async () => {
    const source = '.x { margin-left: 1px; }';
    const proposal = makeProposal('x.css', source);
    const review = markReadyForReview(createReviewSet([proposal], 'input', 'policy'), 'review');
    const approval = approveReviewSet(review, 'apply only after confirmation');
    const auth = createGenericAuthorization(review, approval, review.proposals, { canonicalRoot: '/project-a', repositoryIdentity: 'repo-a' });
    expect(() => assertGenericAuthorizationCurrent(auth, review, approval, review.proposals, { canonicalRoot: '/project-b', repositoryIdentity: 'repo-a' })).toThrow('STALE_OR_TAMPERED_AUTHORIZATION');
    const journal = createTransactionJournal(auth, [{ path: 'x.css', sourceDigest: proposal.sourceDigest, candidateDigest: 'c'.repeat(64), editSetDigest: proposal.editSetDigest, order: 0 }]);
    expect(transitionTransaction(journal, 'Applying').state).toBe('Applying');
    expect(() => transitionTransaction(journal, 'Applied')).toThrow('INVALID_TRANSACTION_TRANSITION');
  });
});

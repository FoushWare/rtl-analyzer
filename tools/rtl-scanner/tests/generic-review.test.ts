import { describe, expect, it } from 'vitest';
import { createFixProposal } from '../src/fix-proposal.js';
import { createReviewSet, markReadyForReview, approveReviewSet, assertApprovalCurrent, GenericReviewRejected, proposalId } from '../src/generic-review.js';
import { validateReviewSet, GenericValidationRejected } from '../src/generic-validation.js';
import { createCodeEvidence, genericEvidenceIntegrity, validateGenericCodeEvidence } from '../src/generic-evidence.js';
import type { Finding } from '../src/model.js';

const makeFinding = (path: string, source: string, start: number, original: string): Finding => ({ id: `f:${path}:${start}`, ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: 'css', applications: [], path, range: { start: { offset: start, line: 1, column: start + 1 }, end: { offset: start + original.length, line: 1, column: start + original.length + 1 } }, original, context: '.x', ownership: 'custom-css', rationale: 'r', treatment: 't', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'l' });
const proposal = (path: string, source: string, property: string, replacement: string) => { const start = source.indexOf(property); return createFixProposal(makeFinding(path, source, start, source.slice(start, start + property.length)), source, [{ path, startOffset: start, endOffset: start + property.length, expectedText: property, replacement }], { inputDigest: 'input', policyDigest: 'policy', transformationId: 'test', transformationVersion: 1 }); };

describe('generic review, validation, and code evidence', () => {
  it('orders multi-file proposals deterministically and binds approval to membership', () => {
    const aSource = '.a { margin-left: 1px; }'; const bSource = '.b { padding-right: 2px; }';
    const review = createReviewSet([proposal('b.css', bSource, 'padding-right', 'padding-inline-end'), proposal('a.css', aSource, 'margin-left', 'margin-inline-start')], 'input', 'policy');
    expect(review.proposals.map(x => x.sourcePath)).toEqual(['a.css', 'b.css']);
    const ready = markReadyForReview(review, 'Review exact code changes'); const approval = approveReviewSet(ready);
    assertApprovalCurrent(approval, ready);
    expect(() => assertApprovalCurrent(approval, { ...ready, proposals: Object.freeze([...ready.proposals.slice(0, 1)]) })).toThrowError(new GenericReviewRejected('STALE_REVIEW_SET'));
    expect(proposalId(review.proposals[0])).toHaveLength(64);
  });

  it('validates source identity, edits, syntax, and creates code-only evidence without browser use', () => {
    const aSource = '.a { margin-left: 1px; }'; const bSource = '.b { padding-right: 2px; }';
    const review = createReviewSet([proposal('a.css', aSource, 'margin-left', 'margin-inline-start'), proposal('b.scss', bSource, 'padding-right', 'padding-inline-end')], 'input', 'policy');
    const ready = markReadyForReview(review, 'Approved static proposal set'); const approval = approveReviewSet(ready);
    const validation = validateReviewSet(ready, new Map([['a.css', aSource], ['b.scss', bSource]]));
    expect(validation.state).toBe('Passed');
    const evidence = createCodeEvidence(ready, approval, validation);
    expect(evidence.beforeSources).toBeUndefined();
    expect(evidence.diffs).toHaveLength(2);
    expect(validateGenericCodeEvidence(evidence).integritySha256).toBe(genericEvidenceIntegrity(evidence));
  });

  it('fails closed for stale sources, tampered proposals, syntax failures, and inconclusive syntax', () => {
    const source = '.x { margin-left: 1px; }'; const p = proposal('x.css', source, 'margin-left', 'margin-inline-start'); const review = markReadyForReview(createReviewSet([p], 'input', 'policy'), 'review');
    expect(() => validateReviewSet(review, new Map([['x.css', source + ' /* changed */']]))).toThrowError(new GenericValidationRejected('STALE_SOURCE'));
    expect(() => validateReviewSet({ ...review, proposals: Object.freeze([{ ...p, editSetDigest: 'tampered' }]) }, new Map([['x.css', source]]))).toThrow();
    const badSource = '.x { margin-left: 1px';
    const bad = proposal('x.css', badSource, 'margin-left', 'margin-inline-start');
    expect(validateReviewSet(markReadyForReview(createReviewSet([bad], 'input', 'policy'), 'review'), new Map([['x.css', badSource]]))).toMatchObject({ state: 'Failed' });
    const unsupported = proposal('x.txt', 'margin-left', 'margin-left', 'x');
    expect(validateReviewSet(markReadyForReview(createReviewSet([unsupported], 'input', 'policy'), 'review'), new Map([['x.txt', 'margin-left']]))).toMatchObject({ state: 'Inconclusive' });
  });
});

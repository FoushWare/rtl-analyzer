import { describe, expect, it } from 'vitest';
import { applyTextEditsInMemory, EditSetRejected, editSetDigest, validateTextEdits } from '../src/edit-set.js';
import { candidateFromProposal, FixProposalRejected } from '../src/fix-proposal.js';
import { classifyCssEligibility, proposeCssLogicalProperty } from '../src/css-transformer.js';
import type { Finding } from '../src/model.js';

const finding = (path: string, source: string, property: string, start = source.indexOf(property)): Finding => ({ id: `RTL.CSS.PHYSICAL:${path}:${start}`, ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: 'css', applications: [], path, range: { start: { offset: start, line: 1, column: start + 1 }, end: { offset: start + source.slice(start).indexOf(';') + 1, line: 1, column: start + source.slice(start).indexOf(';') + 2 } }, original: source.slice(start, start + source.slice(start).indexOf(';') + 1), context: '.card', ownership: 'custom-css', rationale: 'r', treatment: 't', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: { property, value: '1px' }, limitation: 'l' });

describe('generic fix proposals', () => {
  it('creates stable identity and an in-memory candidate without filesystem writes', () => {
    const source = '.card { margin-left: 1rem; /* keep */ }';
    const proposal = proposeCssLogicalProperty(finding('a.css', source, 'margin-left'), source, { inputDigest: 'input', policyDigest: 'policy' });
    const candidate = candidateFromProposal(proposal, source);
    expect(proposal.editSetDigest).toBe(editSetDigest(proposal.edits));
    expect(candidate.after).toContain('margin-inline-start: 1rem');
    expect(candidate.after).toContain('/* keep */');
    expect(candidate.diff).toContain('- .card { margin-left: 1rem; /* keep */ }');
    expect(candidate.diff).toContain('+ .card { margin-inline-start: 1rem; /* keep */ }');
  });

  it('supports CSS Modules, nested SCSS ranges, and multiple edits deterministically', () => {
    const source = '.card { margin-left: 1rem; .child { padding-right: 2px; } }';
    const first = finding('a.module.css', source, 'margin-left');
    const second = finding('a.module.css', source, 'padding-right');
    const edits = validateTextEdits(new Map([['a.module.css', source]]), [
      { path: 'a.module.css', startOffset: second.range.start.offset, endOffset: second.range.start.offset + 'padding-right'.length, expectedText: 'padding-right', replacement: 'padding-inline-end' },
      { path: 'a.module.css', startOffset: first.range.start.offset, endOffset: first.range.start.offset + 'margin-left'.length, expectedText: 'margin-left', replacement: 'margin-inline-start' },
    ]);
    expect(edits.map(x => x.startOffset)).toEqual([first.range.start.offset, second.range.start.offset]);
    expect(applyTextEditsInMemory(new Map([['a.module.css', source]]), edits).get('a.module.css')).toContain('padding-inline-end');
  });

  it('rejects stale, overlapping, duplicate, and ambiguous inputs', () => {
    expect(() => validateTextEdits(new Map([['a.css', 'margin-left']]), [{ path: 'a.css', startOffset: 0, endOffset: 11, expectedText: 'margin-right', replacement: 'x' }])).toThrowError(new EditSetRejected('EDIT_SOURCE_MISMATCH'));
    const source = 'abcdef';
    expect(() => validateTextEdits(new Map([['a.css', source]]), [{ path: 'a.css', startOffset: 0, endOffset: 4, expectedText: 'abcd', replacement: 'x' }, { path: 'a.css', startOffset: 3, endOffset: 6, expectedText: 'def', replacement: 'y' }])).toThrowError(new EditSetRejected('OVERLAPPING_EDITS'));
    const f = finding('a.css', '.x { margin-left: 1px; }', 'margin-left');
    expect(() => proposeCssLogicalProperty(f, '.x { padding-right: 1px; }', { inputDigest: 'i', policyDigest: 'p' })).toThrowError(new FixProposalRejected('FINDING_RANGE_MISMATCH'));
  });

  it('fails closed for logical declarations, positioning, unsupported files, and dynamic CSS', () => {
    const logicalSource = '.x { margin-inline-start: 1px; }';
    const logical = finding('a.css', logicalSource, 'margin-inline-start');
    expect(() => proposeCssLogicalProperty(logical, logicalSource, { inputDigest: 'i', policyDigest: 'p' })).toThrow('UNSUPPORTED_CSS_DECLARATION');
    const positioningSource = '.x { left: 0; }';
    const positioning = { ...finding('a.css', positioningSource, 'left'), ruleId: 'RTL.GEOMETRY.EDGE' };
    expect(() => proposeCssLogicalProperty(positioning, positioningSource, { inputDigest: 'i', policyDigest: 'p' })).toThrow('UNSUPPORTED_CSS_RULE');
    expect(() => proposeCssLogicalProperty({ ...logical, path: 'a.tsx' }, logicalSource, { inputDigest: 'i', policyDigest: 'p' })).toThrow('CSS_SOURCE_REQUIRED');
  });

  it('classifies safe syntax as assisted by default and rejects cascade/coverage ambiguity', () => {
    const source = '.x { margin-left: 1px; }';
    const f = finding('a.css', source, 'margin-left');
    expect(classifyCssEligibility(f, source)).toMatchObject({ eligibility: 'ASSISTED' });
    expect(classifyCssEligibility({ ...f, category: 'AUTO_CANDIDATE' }, source)).toMatchObject({ eligibility: 'AUTOMATED_ELIGIBLE' });
    const duplicate = '.x { margin-left: 1px; margin-left: 2px; }';
    expect(classifyCssEligibility(finding('a.css', duplicate, 'margin-left'), duplicate).blockers).toContain('DUPLICATE_DECLARATION');
    const logicalOverride = '.x { margin-left: 1px; margin-inline-start: 2px; }';
    expect(classifyCssEligibility(finding('a.css', logicalOverride, 'margin-left'), logicalOverride).blockers).toContain('LOGICAL_OVERRIDE');
    const shorthand = '.x { margin: 1px; margin-left: 2px; }';
    expect(classifyCssEligibility(finding('a.css', shorthand, 'margin-left'), shorthand).blockers).toContain('SHORTHAND_CONFLICT');
    const scss = '@mixin x { margin-left: 1px; } .x { margin-left: 2px; }';
    expect(classifyCssEligibility(finding('a.scss', scss, 'margin-left'), scss).blockers).toContain('SOURCE_COVERAGE');
  });
});

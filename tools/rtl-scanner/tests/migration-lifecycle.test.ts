import { describe, expect, it } from 'vitest';
import { projectLifecycle } from '../src/migration-lifecycle.js';

const evidence = [{ decision: 'Approved', scannerAfter: { findingPresent: false }, originalSourceSha256: 'original', candidateSourceSha256: 'candidate' }] as any;
const base = { evidence, decision: null, review: null } as any;

describe('projectLifecycle authoritative priority', () => {
  it.each([
    ['Applied', [{ type: 'APPLIED', resultingSha256: 'candidate', timestamp: '2026-01-01T00:00:00.000Z' }], 'candidate', 'Applied'],
    ['Rolled Back', [{ type: 'APPLIED', resultingSha256: 'candidate', timestamp: '2026-01-01T00:00:00.000Z' }, { type: 'ROLLED_BACK', timestamp: '2026-01-02T00:00:00.000Z' }], 'original', 'Rolled Back'],
    ['Apply Failed', [{ type: 'APPLY_FAILED', timestamp: '2026-01-01T00:00:00.000Z' }], 'original', 'Failed'],
    ['Stale', [{ type: 'APPLIED', resultingSha256: 'candidate', timestamp: '2026-01-01T00:00:00.000Z' }], 'external', 'Stale'],
  ])('%s uses persisted audit/current-source inputs', (_name, audit, currentSourceSha256, expected) => {
    expect(projectLifecycle({ ...base, audit, currentSourceSha256 })).toBe(expected);
  });

  it('keeps a normal approved review in progress before Apply', () => {
    expect(projectLifecycle({ ...base, review: { status: 'Approved' }, currentSourceSha256: 'original', audit: [] })).toBe('Validated');
    expect(projectLifecycle({ ...base, review: { status: 'Candidate Proposed' }, currentSourceSha256: 'original', audit: [] })).toBe('In Progress');
  });
});

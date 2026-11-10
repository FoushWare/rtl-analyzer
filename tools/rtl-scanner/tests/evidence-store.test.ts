import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { EvidenceSnapshotStore, evidenceIntegrity } from '../src/evidence-store.js';
import { REVIEW_SOURCE } from '../src/review-session.js';

const identity = { findingId: 'RTL.BIDI.ISOLATION:741d2ce2aec3a86cf2db37ea', sourcePath: REVIEW_SOURCE, inputDigest: 'input-a', policyDigest: 'policy-a', schemaVersion: 2 } as const;
const base = { ...identity, candidatePatchIdentity: { path: REVIEW_SOURCE, expectedSha256: 'a'.repeat(64), replacementSha256: 'b'.repeat(64) }, originalSourceSha256: 'c'.repeat(64), candidateSourceSha256: 'd'.repeat(64), codeDiff: '- old\n+ new', scannerBefore: { findingPresent: true, resultDigest: 'e'.repeat(64) }, scannerAfter: { findingPresent: false, resultDigest: 'f'.repeat(64) }, browserDomValidation: ['LTR rows=8', 'RTL dir=rtl', 'candidate bdi=1'], screenshotReferences: [], timestamp: new Date().toISOString(), decision: 'Ready for Review' as const };

describe('durable evidence snapshots', () => {
  it('recovers immutable evidence after a new store loads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-evidence-')); const path = join(root, 'review-evidence-v1.json');
    try { const first = new EvidenceSnapshotStore(path); await first.load(); const saved = await first.append(base); const second = new EvidenceSnapshotStore(path); await second.load(); expect(second.list(identity)).toEqual([saved]); await expect(second.append({ ...base, snapshotId: saved.snapshotId })).rejects.toThrow('EVIDENCE_SNAPSHOT_IMMUTABLE'); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('rejects tampered snapshots and stale identities without overwriting storage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-evidence-corrupt-')); const path = join(root, 'review-evidence-v1.json');
    try { const store = new EvidenceSnapshotStore(path); await store.load(); const saved = await store.append(base); const raw = JSON.parse(await readFile(path, 'utf8')); raw.snapshots[0].codeDiff = '- tampered'; await writeFile(path, JSON.stringify(raw)); const recovered = new EvidenceSnapshotStore(path); await recovered.load(); expect(recovered.loadError).toBe('EVIDENCE_INTEGRITY_MISMATCH'); expect(recovered.list({ ...identity, inputDigest: 'new-input' })).toEqual([]); expect(saved.integritySha256).toBe(evidenceIntegrity({ ...base, snapshotId: saved.snapshotId })); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('requires one immutable digest per archived screenshot reference', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-evidence-screenshot-')); const path = join(root, 'review-evidence-v1.json');
    try {
      const store = new EvidenceSnapshotStore(path); await store.load();
      await expect(store.append({ ...base, screenshotReferences: ['screenshots/original-ltr.png'], screenshotDigests: [] })).rejects.toThrow('INVALID_SCREENSHOT_DIGESTS');
      await expect(store.append({ ...base, screenshotReferences: ['screenshots/../escape.png'], screenshotDigests: ['a'.repeat(64)] })).rejects.toThrow('INVALID_EVIDENCE_REFERENCE');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

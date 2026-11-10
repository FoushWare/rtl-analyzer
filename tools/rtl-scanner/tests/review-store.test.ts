import { describe, expect, it } from 'vitest';
import { lstat, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { REVIEW_FINDING_ID, REVIEW_SOURCE } from '../src/review-session.js';
import { ReviewRecordStore, REVIEW_STORE_VERSION } from '../src/review-store.js';

const identity = { findingId: REVIEW_FINDING_ID, sourcePath: REVIEW_SOURCE, inputDigest: 'input-persist', policyDigest: 'policy-persist', schemaVersion: 2 };
const record = { ...identity, status: 'Needs Manual Investigation' as const, reviewerNotes: 'No safe fix established.', evidenceReferences: ['source:78'] };
const decision = { ...identity, sourceDigest: 'a'.repeat(64), recommendation: 'Assisted' as const, recommendationRationale: 'Bounded proposal needs review.', eligibilityConstraints: ['exact range'], blockers: ['HUMAN_SEMANTIC_REVIEW_REQUIRED'], selectedTreatment: 'Assisted' as const };

describe('durable review record store', () => {
  it('persists records and recovers them after a new store is loaded', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-review-store-')); const path = join(root, 'review-records-v1.json');
    try {
      const first = new ReviewRecordStore(path); await first.load(); const saved = await first.saveAndPersist(record); expect(saved.status).toBe('Needs Manual Investigation');
      const second = new ReviewRecordStore(path); await second.load(); expect(second.get(identity)).toMatchObject(record);
      expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ formatVersion: REVIEW_STORE_VERSION, records: [record] });
      expect((await readdir(root)).filter(name => name.includes('.tmp'))).toEqual([]);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('keeps records scoped to report identity and rejects stale transitions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-review-store-stale-')); const path = join(root, 'review-records-v1.json');
    try { const store = new ReviewRecordStore(path); await store.load(); await store.saveAndPersist(record); expect(store.get({ ...identity, inputDigest: 'new-input' })).toBeNull(); await expect(store.saveAndPersist({ ...record, status: 'Approved' })).rejects.toThrow('INVALID_REVIEW_TRANSITION'); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  it('does not overwrite corrupt or incompatible storage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-review-store-corrupt-')); const path = join(root, 'review-records-v1.json');
    try { const original = '{"formatVersion":999,"records":[]}\n'; await writeFile(path, original); const store = new ReviewRecordStore(path); await store.load(); expect(store.loadError).toBe('INCOMPATIBLE_REVIEW_STORE'); await expect(store.saveAndPersist(record)).rejects.toThrow('REVIEW_STORE_UNAVAILABLE'); expect(await readFile(path, 'utf8')).toBe(original); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  it('rejects symlinked storage paths', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-review-store-link-')); const real = join(root, 'real'); const link = join(root, 'link');
    try { await mkdir(real); await symlink(real, link); expect(() => new ReviewRecordStore(join(link, 'review-records-v1.json'))).not.toThrow(); const store = new ReviewRecordStore(join(link, 'review-records-v1.json')); await expect(store.load()).rejects.toThrow('REVIEW_STORE_SYMLINK'); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  it('writes a complete JSON document through the atomic replacement path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-review-store-atomic-')); const path = join(root, 'review-records-v1.json');
    try { const store = new ReviewRecordStore(path); await store.load(); await store.saveAndPersist(record); const stat = await lstat(path); expect(stat.isFile()).toBe(true); expect(JSON.parse(await readFile(path, 'utf8')).records).toHaveLength(1); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  it('persists independent decisions, requires override reasons, and preserves history', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-decision-store-')); const path = join(root, 'review-records-v1.json');
    try {
      const store = new ReviewRecordStore(path); await store.load();
      const first = await store.saveDecision(decision); expect(first.selectedTreatment).toBe('Assisted');
      await expect(store.saveDecision({ ...decision, selectedTreatment: 'Manual' })).rejects.toThrow('OVERRIDE_REASON_REQUIRED');
      const changed = await store.saveDecision({ ...decision, selectedTreatment: 'Manual', overrideReason: 'Product semantics require review.' }); expect(changed.history).toHaveLength(1); expect(changed.history[0].selectedTreatment).toBe('Assisted');
      const other = { ...decision, findingId: 'RTL.BIDI.ISOLATION:741d2ce2aec3a86cf2db37ea', recommendation: 'Automated' as const, selectedTreatment: 'Automated' as const, blockers: [] };
      await store.saveDecision(other); const recovered = new ReviewRecordStore(path); await recovered.load(); expect(recovered.getDecision(identity)?.selectedTreatment).toBe('Manual'); expect(recovered.getDecision({ ...identity, findingId: other.findingId })?.selectedTreatment).toBe('Automated');
      await expect(store.saveDecision({ ...decision, selectedTreatment: 'Automated', overrideReason: 'unsafe' })).rejects.toThrow('AUTOMATED_TREATMENT_NOT_ELIGIBLE');
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, symlink, writeFile, rm, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planOutputPath, OutputPathError } from '../src/output-path.js';
import { toSchemaV2Presentation } from '../src/presentation-adapter.js';
import { json } from '../src/report.js';
import type { Report } from '../src/model.js';

const report = (): Report => ({ schemaVersion: 2, kind: 'rtl-risk-report', policyDigest: 'p', inputDigest: 'i', files: [], skipped: [], evidence: [{ id: 'e1', path: 'a.css', mechanism: 'css', context: 'x', property: 'margin-left', value: '1px', original: 'margin-left: 1px', range: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 17, line: 1, column: 18 } }, semantics: 'css' }], diagnostics: [], findings: [{ id: 'f1', ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'x', sourceMechanism: 'css', applications: [], path: 'a.css', range: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 17, line: 1, column: 18 } }, original: 'margin-left: 1px', context: 'x', ownership: 'custom-css', rationale: 'x', treatment: 'x', evidenceIds: ['e1', 'missing', 'e1'], relatedLocations: [{ path: 'b.css', range: { start: { offset: 1, line: 1, column: 2 }, end: { offset: 2, line: 1, column: 3 } } }], issueIds: [], suggestion: null, limitation: 'x' }], metrics: { byCategory: { MANUAL_REVIEW: 1 }, bySeverity: { Minor: 1 }, byConfidence: { High: 1 }, uniqueAffectedFiles: 1, referenceCaseIds: [] }, complete: true });

describe('Milestone 1 output architecture', () => {
  it('adapts schema-v2 without changing canonical serialization', () => {
    const source = report();
    expect(json(source)).toBe(json(toSchemaV2Presentation(source) as unknown as Report));
    expect(() => (toSchemaV2Presentation(source).files as string[]).push('x')).toThrow();
    const view = toSchemaV2Presentation(source);
    expect(view.evidenceReferences[0].evidence[0]).toEqual(source.evidence[0]);
    expect(view.evidenceReferences[0].missingEvidenceIds).toEqual(['missing']);
    expect(view.evidenceReferences[0].duplicateEvidenceIds).toEqual(['e1']);
    expect(() => { (view.findings[0].range.start as { line: number }).line = 9; }).toThrow();
    expect(() => { (view.evidence[0].original as unknown as string) = 'changed'; }).toThrow();
    expect(view.evidenceReferences[0].evidenceIds).toEqual(['e1', 'missing', 'e1']);
  });

  it('plans safe report destinations without filesystem writes', async () => {
    const tempRoot = await realpath(tmpdir());
    expect((await planOutputPath('/repo', join(tempRoot, 'atlas-scan-output.json'), 'json')).format).toBe('json');
    expect((await planOutputPath('/repo', join(tempRoot, 'atlas-scan-output.md'), 'markdown')).format).toBe('markdown');
  });

  it.each(['../scan.json', 'apps/a/report.json', 'reports/scan.md', 'reports\\scan.json', ''])('rejects unsafe output path %s', async path => {
    await expect(planOutputPath('/repo', path, 'json')).rejects.toThrow(OutputPathError);
  });

  it('rejects existing destinations and symlinked ancestors read-only', async () => {
    const tempRoot = await realpath(tmpdir());
    const root = await mkdtemp(join(tempRoot, 'atlas-output-'));
    const external = await mkdtemp(join(tempRoot, 'atlas-output-external-'));
    try {
      await mkdir(join(root, 'reports'));
      await writeFile(join(root, 'reports', 'existing.json'), '{}');
      await expect(planOutputPath(root, 'reports/existing.json', 'json')).rejects.toMatchObject({ code: 'INPUT_TREE' });
      const externalExisting = join(external, 'existing.json');
      await writeFile(externalExisting, '{}');
      await expect(planOutputPath(root, externalExisting, 'json')).rejects.toMatchObject({ code: 'EXISTS' });
      const linkedTarget = join(external, 'linked-target');
      const linkedAncestor = join(external, 'linked');
      await mkdir(linkedTarget);
      try { await symlink(linkedTarget, linkedAncestor); } catch (error) {
        if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') return;
        throw error;
      }
      await expect(planOutputPath(root, join(linkedAncestor, 'new.json'), 'json')).rejects.toThrow(/SYMLINK/);
      await rm(externalExisting, { force: true });
    } finally { await rm(root, { recursive: true, force: true }); await rm(external, { recursive: true, force: true }); }
  });
});

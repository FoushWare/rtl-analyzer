import { writeFileSync } from 'node:fs';
import { dashboardHtml } from '../../dist/tools/rtl-scanner/dashboard-html.js';
import { toSchemaV2Presentation } from '../../dist/tools/rtl-scanner/presentation-adapter.js';

export const phase5Findings = [
  { id: 'manual-1', ruleId: 'R', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'manual-1', sourceMechanism: 'css', applications: ['invoicing'], path: 'fixture.tsx', range: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } }, original: 'manual-1', context: 'manual-1', ownership: 'test', rationale: 'test', treatment: 'review', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'test' },
  { id: 'assisted-1', ruleId: 'R', ruleVersion: 1, category: 'RUNTIME_CONFIG', severity: 'Minor', confidence: 'High', title: 'assisted-1', sourceMechanism: 'css', applications: ['invoicing'], path: 'fixture.tsx', range: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } }, original: 'assisted-1', context: 'assisted-1', ownership: 'test', rationale: 'test', treatment: 'review', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'test' },
];

export const phase5Manifest = {
  scanId: 'phase5-initial', inputDigest: 'phase5-input', policyDigest: 'phase5-policy', timestamp: '2026-01-01T00:00:00.000Z',
  sourceCoverage: { complete: true, filesAnalyzed: 1, filesExpected: 1 }, findings: phase5Findings,
};

export function writePhase5Dashboard(directory) {
  const report = { schemaVersion: 2, kind: 'rtl-risk-report', policyDigest: phase5Manifest.policyDigest, inputDigest: phase5Manifest.inputDigest, files: ['fixture.tsx'], skipped: [], evidence: [], diagnostics: [], findings: phase5Findings, metrics: { byCategory: { MANUAL_REVIEW: 1, RUNTIME_CONFIG: 1 }, bySeverity: { Minor: 2 }, byConfidence: { High: 2 }, uniqueAffectedFiles: 1, referenceCaseIds: [] }, complete: true };
  writeFileSync(`${directory}/rtl-report-dashboard.html`, dashboardHtml(toSchemaV2Presentation(report), false));
}

export function writePhase5ProjectFixture(project) {
  writeFileSync(`${project}/fixture.tsx`, '// Disposable Phase 5 source fixture.\n');
}

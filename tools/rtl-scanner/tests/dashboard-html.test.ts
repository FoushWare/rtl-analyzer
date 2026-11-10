import { describe, expect, it } from 'vitest';
import { dashboardHtml } from '../src/dashboard-html.js';
import { severityDisplayLabel, toDashboardData } from '../src/dashboard-data.js';
import { toSchemaV2Presentation } from '../src/presentation-adapter.js';
import type { Report } from '../src/model.js';

const report = (reverse = false): Report => ({
  schemaVersion: 2, kind: 'rtl-risk-report', policyDigest: 'policy', inputDigest: 'input', files: ['a.tsx'], skipped: [], evidence: [], diagnostics: [],
  findings: reverse ? [] : [{ id: 'f1', ruleId: 'R1', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Major', confidence: 'High', title: '</script><bdi>مرحبا</bdi>', sourceMechanism: 'css', applications: [], path: 'a.tsx', range: { start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } }, original: 'x', context: 'x', ownership: 'owner', rationale: 'x', treatment: 'review', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'x' }],
  metrics: { byCategory: { MANUAL_REVIEW: reverse ? 0 : 1 }, bySeverity: { Major: reverse ? 0 : 1 }, byConfidence: { High: reverse ? 0 : 1 }, uniqueAffectedFiles: reverse ? 0 : 1, referenceCaseIds: [] }, complete: true,
});

describe('dashboard HTML', () => {
  it('maps canonical severities to presentation labels without changing canonical values', () => {
    expect(severityDisplayLabel('Major')).toBe('High Priority');
    expect(severityDisplayLabel('Minor')).toBe('Low Priority');
    expect(severityDisplayLabel('Info')).toBe('Informational');
    const html = dashboardHtml(toSchemaV2Presentation(report()));
    expect(html).toContain('High Priority');
    expect(html).toContain("Severity',severityLabel(f.severity)");
    expect(html).toContain('Total Findings');
    expect(html).toContain('Severity distribution:');
    expect(html).toContain("severityLabel(x[1])+' · '+x[2]+' · '+pct(x[2])+'%'");
    expect(toDashboardData(toSchemaV2Presentation(report())).queue.major[0]?.severity).toBe('Major');
    expect(dashboardHtml(toSchemaV2Presentation(report(true)))).toContain('rawTotal=major+minor+info');
  });
  it('renders a self-contained accessible dashboard and safely embeds hostile values', () => {
    const html = dashboardHtml(toSchemaV2Presentation(report()));
    expect(html).toContain('<!doctype html>'); expect(html).toContain('dir="ltr"'); expect(html).toContain('type="application/json"');
    expect(html).toContain('\\u003c/script\\u003e'); expect(html).toContain('unicode-bidi:isolate'); expect(html).toContain('focus-visible');
    expect(html).not.toContain('</script><bdi>'); expect(html).not.toContain('https://'); expect(html).toContain("fetch(previewOrigin+'/health')");
    expect(html).toContain('rtl-dashboard-data'); expect(html).toContain('aria-label='); expect(html).toContain('focus-visible');
    expect(html).toContain('RTL Migration Analyzer v3'); expect(html).toContain('High Priority'); expect(html).toContain('severity-chart'); expect(html).toContain('grid-template-columns:1.35fr .85fr .9fr .9fr .9fr .95fr 1.75fr'); expect(html).toContain('workspace-secondary'); expect(html).toContain('Analysis Scope'); expect(html).toContain('PROJECT EXPLORER'); expect(html).toContain('SOURCE PREVIEW'); expect(html).toContain('FINDING DETAILS');
    expect(html).not.toContain('rtl-report.json'); expect(html).toContain('Review Workspace'); expect(html).toContain('Candidate Evidence'); expect(html).toContain('Controlled Apply & Rollback'); expect(html).toContain('APPLY_CONFIRMED'); expect(html).toContain('Rollback Change'); expect(html).toContain('aria-live'); expect(html).toContain('/review/apply/eligibility'); expect(html).toContain('/review/audit'); expect(html).toContain('Codemod Eligibility:'); expect(html).toContain('Embedded offline assessment (not persisted)'); expect(html).toContain('Start Investigation'); expect(html).toContain('Mark Verified Correct'); expect(html).toContain('Request Manual Investigation'); expect(html).toContain('Mark Ready for Review'); expect(html).toContain('Approval is a review decision only'); expect(html).toContain('Validation Results'); expect(html).toContain('Scanner before / after'); expect(html).toContain('Browser, DOM and screenshots'); expect(html).toContain('Evidence Details'); expect(html).toContain('Open larger preview'); expect(html).toContain('Audit History'); expect(html).toContain('Approved Diff'); expect(html).not.toContain('Save Review');
  });
  it('is deterministic and maps the presentation model without mutation', () => {
    const source = report(); const view = toSchemaV2Presentation(source); const before = JSON.stringify(view);
    expect(dashboardHtml(view)).toBe(dashboardHtml(toSchemaV2Presentation(report()))); expect(JSON.stringify(view)).toBe(before);
    const data = toDashboardData(view); expect(data.queue.major).toHaveLength(1); expect(Object.values(data.queue).flat()).toHaveLength(data.findings); expect(data.viewModelVersion).toBe(1); expect(data.explorer.initialFindingId).toBe('f1'); expect(data.explorer.root.files[0]?.findingIds).toEqual(['f1']); expect(dashboardHtml(view)).toContain('Source preview unavailable');
    expect(data.scopeBreakdown.unresolvedReachability).toBeNull(); expect(data.scopeBreakdown.sharedLibraryOwnership).toBeNull(); expect(data.scopeBreakdown.sharedLibraryImpact).toBeNull(); expect(data.scopeBreakdown.directApplications).toEqual([]); expect(dashboardHtml(view)).toContain('Unknown attribution'); expect(dashboardHtml(view)).toContain('counts are not additive and may overlap'); expect(dashboardHtml(view)).toContain('Not available'); expect(dashboardHtml(view)).not.toContain('Shared or unresolved reachability');
    expect(dashboardHtml(view, true)).toContain('href="rtl-report.json"');
  });
  it('uses only explicit application attribution and never infers shared dimensions from paths', () => {
    const base = report();
    const attributed: Report = { ...base, files: ['libs/shared.ts'], findings: [{ ...base.findings[0]!, path: 'libs/shared.ts', applications: ['invoicing', 'procurement'] }] };
    const data = toDashboardData(toSchemaV2Presentation(attributed));
    expect(data.findings).toBe(1);
    expect(data.scopeBreakdown.directApplications).toEqual([{ name: 'invoicing', count: 1 }, { name: 'procurement', count: 1 }]);
    expect(data.scopeBreakdown.sharedLibraryOwnership).toBeNull();
    expect(data.scopeBreakdown.sharedLibraryImpact).toBeNull();
    expect(data.scopeBreakdown.unresolvedReachability).toBeNull();
    expect(data.breakdowns.application).toEqual(data.scopeBreakdown.directApplications);
  });
});

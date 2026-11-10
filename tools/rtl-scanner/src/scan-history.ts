import { createHash } from 'node:crypto';
import type { Finding, Report } from './model.js';

export type FindingReconciliation = 'New' | 'Changed' | 'Resolved' | 'Stale' | 'Unresolved';
export interface ScanManifest { readonly scanId: string; readonly inputDigest: string; readonly policyDigest: string; readonly timestamp: string; readonly findings: readonly Finding[]; readonly sourceCoverage?: { readonly complete: boolean; readonly filesAnalyzed: number; readonly filesExpected?: number } }
export interface ReconciledFinding { readonly findingId: string; readonly currentId?: string; readonly status: FindingReconciliation; readonly confidence: 'Exact' | 'Structural' | 'Ambiguous' }

const structuralKey = (f: Finding) => `${f.ruleId}|${f.path}|${f.sourceMechanism}|${f.context}|${f.original}`;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export function manifestFromReport(report: Report, timestamp = new Date().toISOString()): ScanManifest { return { scanId: digest(`${report.inputDigest}|${timestamp}`), inputDigest: report.inputDigest, policyDigest: report.policyDigest, timestamp, findings: report.findings.map(f => ({ ...f, relatedLocations: [...f.relatedLocations], evidenceIds: [...f.evidenceIds] })) }; }
export function reconcileScans(previous: ScanManifest | null, current: ScanManifest): readonly ReconciledFinding[] {
  if (!previous) return current.findings.map(f => ({ findingId: f.id, currentId: f.id, status: 'New', confidence: 'Exact' }));
  const oldById = new Map(previous.findings.map(f => [f.id, f]));
  const oldByStructure = new Map<string, Finding[]>();
  for (const f of previous.findings) oldByStructure.set(structuralKey(f), [...(oldByStructure.get(structuralKey(f)) ?? []), f]);
  const seen = new Set<string>(); const result: ReconciledFinding[] = [];
  for (const f of current.findings) {
    const exact = oldById.get(f.id);
    if (exact) { seen.add(exact.id); result.push({ findingId: exact.id, currentId: f.id, status: structuralKey(exact) === structuralKey(f) ? 'Unresolved' : 'Changed', confidence: 'Exact' }); continue; }
    const matches = oldByStructure.get(structuralKey(f)) ?? [];
    if (matches.length === 1) { seen.add(matches[0].id); result.push({ findingId: matches[0].id, currentId: f.id, status: 'Changed', confidence: 'Structural' }); }
    else if (matches.length > 1) result.push({ findingId: f.id, currentId: f.id, status: 'Stale', confidence: 'Ambiguous' });
    else result.push({ findingId: f.id, currentId: f.id, status: 'New', confidence: 'Exact' });
  }
  for (const f of previous.findings) if (!seen.has(f.id)) result.push({ findingId: f.id, status: current.sourceCoverage?.complete === false ? 'Stale' : 'Resolved', confidence: 'Exact' });
  return result;
}

import type { Diagnostic, Evidence, Finding, Report } from './model.js';

/** The read-only view consumed by future report renderers. */
export interface SchemaV2PresentationReport {
  readonly schemaVersion: 2;
  readonly kind: 'rtl-risk-report';
  readonly policyDigest: string;
  readonly inputDigest: string;
  readonly files: readonly string[];
  readonly skipped: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly diagnostics: readonly Diagnostic[];
  readonly findings: readonly Finding[];
  readonly metrics: {
    readonly byCategory: Readonly<Record<string, number>>;
    readonly bySeverity: Readonly<Record<string, number>>;
    readonly byConfidence: Readonly<Record<string, number>>;
    readonly uniqueAffectedFiles: number;
    readonly referenceCaseIds: readonly string[];
  };
  readonly complete: boolean;
  readonly evidenceReferences: readonly EvidenceReference[];
}

export interface EvidenceReference {
  readonly findingId: string;
  readonly evidenceIds: readonly string[];
  readonly evidence: readonly Evidence[];
  readonly missingEvidenceIds: readonly string[];
  readonly duplicateEvidenceIds: readonly string[];
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Adapt the canonical report without changing its shape, ordering, or bytes.
 * Renderers must not mutate the scan result through this view.
 */
export function toSchemaV2Presentation(report: Report): SchemaV2PresentationReport {
  const evidence = clone(report.evidence);
  const findings = clone(report.findings);
  const evidenceById = new Map<string, Evidence[]>();
  for (const item of evidence) evidenceById.set(item.id, [...(evidenceById.get(item.id) ?? []), item]);
  const evidenceReferences = findings.map((finding): EvidenceReference => {
    const evidenceForFinding: Evidence[] = [];
    const missingEvidenceIds: string[] = [];
    const duplicateEvidenceIds: string[] = [];
    const seen = new Set<string>();
    for (const id of finding.evidenceIds) {
      const matches = evidenceById.get(id) ?? [];
      if (seen.has(id)) duplicateEvidenceIds.push(id);
      seen.add(id);
      if (!matches.length) missingEvidenceIds.push(id);
      else evidenceForFinding.push(matches[0]);
      if (matches.length > 1) duplicateEvidenceIds.push(id);
    }
    return { findingId: finding.id, evidenceIds: [...finding.evidenceIds], evidence: evidenceForFinding, missingEvidenceIds, duplicateEvidenceIds };
  });
  const presentation = {
    schemaVersion: report.schemaVersion,
    kind: report.kind,
    policyDigest: report.policyDigest,
    inputDigest: report.inputDigest,
    files: clone(report.files), skipped: clone(report.skipped), evidence, diagnostics: clone(report.diagnostics), findings,
    metrics: clone(report.metrics), complete: report.complete,
  } as unknown as SchemaV2PresentationReport & { evidenceReferences: EvidenceReference[] };
  freezeDeep(evidenceReferences);
  Object.defineProperty(presentation, 'evidenceReferences', { value: evidenceReferences, enumerable: false, writable: false, configurable: false });
  return freezeDeep(presentation);
}

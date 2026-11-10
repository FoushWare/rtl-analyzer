import type { MigrationDecision } from './review-store.js';
import type { ReviewRecord } from './review-session.js';
import type { EvidenceSnapshot } from './evidence-store.js';
import type { ApplyAuditEvent } from './controlled-apply.js';

export type MigrationLifecycle = 'Pending' | 'In Progress' | 'Applied' | 'Validated' | 'Failed' | 'Stale' | 'Rolled Back';

export interface LifecycleInput {
  readonly decision?: MigrationDecision | null;
  readonly review?: ReviewRecord | null;
  readonly evidence: readonly EvidenceSnapshot[];
  readonly audit: readonly ApplyAuditEvent[];
  readonly currentSourceSha256?: string;
}

export function projectLifecycle(input: LifecycleInput): MigrationLifecycle {
  const latestAudit = input.audit.slice().sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  if (latestAudit?.type === 'ROLLED_BACK') return 'Rolled Back';
  if (latestAudit?.type === 'APPLY_FAILED' || latestAudit?.type === 'ROLLBACK_FAILED') return 'Failed';
  const approvedEvidence = input.evidence.find(e => (e.decision === 'Approved' || e.decision === 'Ready for Review') && !e.scannerAfter.findingPresent);
  if (latestAudit?.type === 'APPLIED') return input.currentSourceSha256 && latestAudit.resultingSha256 === input.currentSourceSha256 ? 'Applied' : 'Stale';
  if (approvedEvidence && input.currentSourceSha256 && input.currentSourceSha256 !== approvedEvidence.originalSourceSha256 && input.currentSourceSha256 !== approvedEvidence.candidateSourceSha256) return 'Stale';
  if (approvedEvidence && input.review?.status === 'Approved') return 'Validated';
  if (input.review?.status === 'Validation Failed') return 'Failed';
  if (input.review?.status === 'Candidate Proposed' || input.review?.status === 'Ready for Review' || input.review?.status === 'Approved' || input.decision) return 'In Progress';
  return 'Pending';
}

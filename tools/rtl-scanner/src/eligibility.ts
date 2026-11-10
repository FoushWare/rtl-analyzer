import type { Finding } from './model.js';
import { BIDI_TRANSFORMATION_ID, proposeBidiIsolation } from './codemod.js';

export type CodemodEligibility = 'MANUAL' | 'ASSISTED' | 'AUTOMATED_ELIGIBLE';
export interface EligibilityDecision { eligibility: CodemodEligibility; reason: string; evidence: readonly string[]; transformationId: string | null; blockers: readonly string[] }

// Deliberately empty until a transformation implementation and its preconditions are verified.
export const verifiedTransformationStrategies: Readonly<Record<string, { preconditions: readonly string[]; transformationId: string }>> = { 'RTL.BIDI.ISOLATION:invoice-id': { preconditions: ['exact InvoiceTable.tsx finding range', 'direct i.id JSX expression', 'no bdi or dir ancestor'], transformationId: BIDI_TRANSFORMATION_ID } };

export function classifyEligibility(finding: Finding, evidenceComplete = true, sourceText?: string): EligibilityDecision {
  if (!evidenceComplete) return { eligibility: 'MANUAL', reason: 'Required evidence is incomplete or stale.', evidence: finding.evidenceIds, transformationId: null, blockers: ['INCOMPLETE_OR_STALE_EVIDENCE'] };
  if (finding.ruleId === 'RTL.BIDI.ISOLATION' && sourceText) { try { const proposal = proposeBidiIsolation(finding, sourceText); return { eligibility: 'AUTOMATED_ELIGIBLE', reason: 'The verified bidi-isolation transformation matches the exact supported AST shape and bounded source range.', evidence: finding.evidenceIds, transformationId: proposal.transformationId, blockers: [] }; } catch (error) { return { eligibility: 'ASSISTED', reason: 'A bounded bidi-isolation proposal exists, but the source does not satisfy the verified transformation preconditions.', evidence: finding.evidenceIds, transformationId: BIDI_TRANSFORMATION_ID, blockers: [error instanceof Error ? error.message : 'TRANSFORMATION_PRECONDITION_FAILED'] }; } }
  if (finding.ruleId === 'RTL.BIDI.ISOLATION' && finding.path === 'apps/invoicing/src/components/InvoiceTable.tsx') return { eligibility: 'ASSISTED', reason: 'A bounded bidi-isolation proposal is possible, but rendered punctuation and product semantics still require human review.', evidence: finding.evidenceIds, transformationId: 'bidi-isolate-auto', blockers: ['HUMAN_SEMANTIC_REVIEW_REQUIRED', 'NO_VERIFIED_CODEMOD_IMPLEMENTATION'] };
  return { eligibility: 'MANUAL', reason: 'Semantic intent, runtime behavior, or styling ownership is not established by static evidence.', evidence: finding.evidenceIds, transformationId: null, blockers: ['SEMANTIC_OR_RUNTIME_INTENT_UNPROVEN'] };
}

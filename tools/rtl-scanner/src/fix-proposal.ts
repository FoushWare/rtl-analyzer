import { createHash } from 'node:crypto';
import type { Finding } from './model.js';
import { applyTextEditsInMemory, editSetDigest, type TextEdit, type ValidatedTextEdit, unifiedTextDiff, validateTextEdits } from './edit-set.js';

export interface FixProposal {
  readonly findingId: string;
  readonly ruleId: string;
  readonly ruleVersion: number;
  readonly sourcePath: string;
  readonly sourceDigest: string;
  readonly inputDigest: string;
  readonly policyDigest: string;
  readonly schemaVersion: number;
  readonly transformationId: string;
  readonly transformationVersion: number;
  readonly edits: readonly ValidatedTextEdit[];
  readonly editSetDigest: string;
}

export interface ProposalCandidate {
  readonly proposal: FixProposal;
  readonly before: string;
  readonly after: string;
  readonly diff: string;
}

export class FixProposalRejected extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

export function createFixProposal(finding: Finding, source: string, edits: readonly TextEdit[], identity: { inputDigest: string; policyDigest: string; transformationId: string; transformationVersion?: number }): FixProposal {
  if (!finding.id || !finding.ruleId || finding.ruleVersion !== 1 || finding.path !== edits[0]?.path) throw new FixProposalRejected('FINDING_IDENTITY_MISMATCH');
  const validated = validateTextEdits(new Map([[finding.path, source]]), edits);
  if (!validated.length) throw new FixProposalRejected('EMPTY_EDIT_SET');
  if (validated.some(edit => edit.path !== finding.path)) throw new FixProposalRejected('EDIT_PATH_MISMATCH');
  if (source.slice(finding.range.start.offset, finding.range.end.offset) !== finding.original) throw new FixProposalRejected('FINDING_RANGE_MISMATCH');
  const proposal = { findingId: finding.id, ruleId: finding.ruleId, ruleVersion: finding.ruleVersion, sourcePath: finding.path, sourceDigest: digest(source), inputDigest: identity.inputDigest, policyDigest: identity.policyDigest, schemaVersion: 2, transformationId: identity.transformationId, transformationVersion: identity.transformationVersion ?? 1, edits: validated, editSetDigest: editSetDigest(validated) } satisfies FixProposal;
  return Object.freeze({ ...proposal, edits: Object.freeze([...validated]) });
}

export function candidateFromProposal(proposal: FixProposal, source: string): ProposalCandidate {
  if (digest(source) !== proposal.sourceDigest) throw new FixProposalRejected('STALE_SOURCE');
  const edits = validateTextEdits(new Map([[proposal.sourcePath, source]]), proposal.edits);
  if (editSetDigest(edits) !== proposal.editSetDigest) throw new FixProposalRejected('EDIT_SET_DIGEST_MISMATCH');
  const after = applyTextEditsInMemory(new Map([[proposal.sourcePath, source]]), edits).get(proposal.sourcePath)!;
  return { proposal, before: source, after, diff: unifiedTextDiff(proposal.sourcePath, source, after) };
}

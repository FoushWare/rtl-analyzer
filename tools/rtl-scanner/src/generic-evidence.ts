import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { GenericReviewSet, GenericApproval } from './generic-review.js';
import type { GenericValidationResult } from './generic-validation.js';

export interface GenericCodeEvidence {
  readonly formatVersion: 1;
  readonly evidenceId: string;
  readonly reviewSetId: string;
  readonly proposalIds: readonly string[];
  readonly reviewSetDigest: string;
  readonly inputDigest: string;
  readonly policyDigest: string;
  readonly sourceDigests: Readonly<Record<string, string>>;
  readonly candidateDigests: Readonly<Record<string, string>>;
  readonly editSetDigests: readonly string[];
  readonly diffs: readonly string[];
  readonly syntaxChecks: GenericValidationResult['syntaxChecks'];
  readonly limitations: readonly string[];
  readonly beforeSources?: Readonly<Record<string, string>>;
  readonly afterSources?: Readonly<Record<string, string>>;
  readonly integritySha256: string;
  readonly createdAt: string;
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const payloadOf = (evidence: Omit<GenericCodeEvidence, 'integritySha256'> | GenericCodeEvidence) => { const { integritySha256: _ignored, ...payload } = evidence as GenericCodeEvidence; return payload; };
export const genericEvidenceIntegrity = (evidence: Omit<GenericCodeEvidence, 'integritySha256'> | GenericCodeEvidence) => digest(payloadOf(evidence));

export function createCodeEvidence(review: GenericReviewSet, approval: GenericApproval, validation: GenericValidationResult, includeSource = false): GenericCodeEvidence {
  if (validation.reviewSetId !== review.reviewSetId || validation.state !== 'Passed') throw new Error('CODE_VALIDATION_REQUIRED');
  const base = { formatVersion: 1 as const, evidenceId: digest({ reviewSetId: review.reviewSetId, proposalIds: review.proposalIds, candidateDigests: validation.candidateDigests }), reviewSetId: review.reviewSetId, proposalIds: [...review.proposalIds], reviewSetDigest: approval.reviewSetDigest, inputDigest: review.inputDigest, policyDigest: review.policyDigest, sourceDigests: validation.sourceDigests, candidateDigests: validation.candidateDigests, editSetDigests: review.proposals.map(proposal => proposal.editSetDigest), diffs: [...validation.diffs], syntaxChecks: [...validation.syntaxChecks], limitations: [...validation.limitations], ...(includeSource ? { beforeSources: Object.fromEntries([...validation.originalSources]), afterSources: Object.fromEntries([...validation.candidateSources]) } : {}), createdAt: new Date().toISOString() } satisfies Omit<GenericCodeEvidence, 'integritySha256'>;
  return Object.freeze({ ...base, integritySha256: genericEvidenceIntegrity(base) });
}

export function validateGenericCodeEvidence(evidence: GenericCodeEvidence): GenericCodeEvidence {
  if (evidence.formatVersion !== 1 || evidence.integritySha256 !== genericEvidenceIntegrity(evidence) || !evidence.reviewSetId || !evidence.proposalIds.length || !Array.isArray(evidence.diffs) || !Array.isArray(evidence.syntaxChecks)) throw new Error('INVALID_GENERIC_CODE_EVIDENCE');
  return evidence;
}

export class GenericCodeEvidenceStore {
  constructor(readonly path: string) {}
  async append(evidence: GenericCodeEvidence): Promise<void> { validateGenericCodeEvidence(evidence); await mkdir(dirname(this.path), { recursive: true, mode: 0o700 }); const current = await this.list(); const temporary = `${this.path}.${process.pid}.tmp`; await writeFile(temporary, `${JSON.stringify([...current, evidence], null, 2)}\n`, { encoding: 'utf8', mode: 0o600 }); await rename(temporary, this.path); }
  async list(): Promise<GenericCodeEvidence[]> { try { return JSON.parse(await readFile(this.path, 'utf8')) as GenericCodeEvidence[]; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw new Error('GENERIC_EVIDENCE_UNREADABLE'); } }
}

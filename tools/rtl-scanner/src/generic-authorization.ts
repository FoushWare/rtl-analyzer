import { createHash } from 'node:crypto';
import type { FixProposal } from './fix-proposal.js';
import type { GenericApproval, GenericReviewSet } from './generic-review.js';
import { assertApprovalCurrent, proposalId } from './generic-review.js';
import { createPersistedRecord, type PersistedRecord } from './generic-persistence.js';

export interface ProjectIdentity { readonly canonicalRoot: string; readonly repositoryIdentity?: string }
export interface GenericAuthorization extends PersistedRecord {
  readonly kind: 'generic-authorization';
  readonly projectIdentityDigest: string;
  readonly reviewSetId: string;
  readonly reviewSetDigest: string;
  readonly proposalIds: readonly string[];
  readonly editSetDigests: readonly string[];
  readonly sourceDigests: readonly string[];
  readonly sourcePaths: readonly string[];
  readonly inputDigest: string;
  readonly policyDigest: string;
  readonly transformations: readonly { id: string; version: number }[];
  readonly schemaVersion: 2;
  readonly authorizationId: string;
  readonly applyConfirmationRequired: true;
}

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const projectIdentityDigest = (identity: ProjectIdentity): string => hash({ canonicalRoot: identity.canonicalRoot, repositoryIdentity: identity.repositoryIdentity ?? null });

export function createGenericAuthorization(review: GenericReviewSet, approval: GenericApproval, proposals: readonly FixProposal[], project: ProjectIdentity): GenericAuthorization {
  assertApprovalCurrent(approval, review);
  if (proposals.length !== review.proposals.length || proposals.some((proposal, index) => proposalId(proposal) !== proposalId(review.proposals[index]!))) throw new Error('AUTHORIZATION_PROPOSAL_MISMATCH');
  const pid = projectIdentityDigest(project);
  const payload = { id: hash({ pid, reviewSetId: review.reviewSetId, reviewSetDigest: approval.reviewSetDigest }), kind: 'generic-authorization' as const, formatVersion: 1, projectIdentityDigest: pid, reviewSetId: review.reviewSetId, reviewSetDigest: approval.reviewSetDigest, proposalIds: proposals.map(proposalId), editSetDigests: proposals.map(proposal => proposal.editSetDigest), sourceDigests: proposals.map(proposal => proposal.sourceDigest), sourcePaths: proposals.map(proposal => proposal.sourcePath), inputDigest: review.inputDigest, policyDigest: review.policyDigest, transformations: proposals.map(proposal => ({ id: proposal.transformationId, version: proposal.transformationVersion })), schemaVersion: 2 as const, authorizationId: hash({ pid, reviewSetId: review.reviewSetId, proposalIds: approval.proposalIds }), applyConfirmationRequired: true as const };
  return createPersistedRecord(payload) as GenericAuthorization;
}

export function assertGenericAuthorizationCurrent(auth: GenericAuthorization, review: GenericReviewSet, approval: GenericApproval, proposals: readonly FixProposal[], project: ProjectIdentity): void {
  const expected = createGenericAuthorization(review, approval, proposals, project);
  if (auth.integritySha256 !== expected.integritySha256 || auth.authorizationId !== expected.authorizationId || auth.projectIdentityDigest !== projectIdentityDigest(project)) throw new Error('STALE_OR_TAMPERED_AUTHORIZATION');
}

import { createHash } from 'node:crypto';
import type { FixProposal } from './fix-proposal.js';

export type GenericReviewStatus = 'Draft' | 'Ready for Review' | 'Approved' | 'Rejected' | 'Stale';
export interface GenericReviewSet {
  readonly reviewSetId: string;
  readonly schemaVersion: 2;
  readonly proposals: readonly FixProposal[];
  readonly proposalIds: readonly string[];
  readonly sourceDigests: Readonly<Record<string, string>>;
  readonly inputDigest: string;
  readonly policyDigest: string;
  readonly status: GenericReviewStatus;
  readonly reviewerNotes: string;
  readonly rejectionReason?: string;
}
export interface GenericApproval {
  readonly reviewSetId: string;
  readonly proposalIds: readonly string[];
  readonly reviewSetDigest: string;
  readonly status: 'Approved';
  readonly approvedAt: string;
  readonly reviewerNotes: string;
}

export class GenericReviewRejected extends Error { constructor(readonly code: string) { super(code); } }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const canonicalProposal = (proposal: FixProposal) => ({ ...proposal, edits: proposal.edits.map(edit => ({ path: edit.path, startOffset: edit.startOffset, endOffset: edit.endOffset, expectedText: edit.expectedText, replacement: edit.replacement, expectedSha256: edit.expectedSha256, replacementSha256: edit.replacementSha256 })) });
export const proposalId = (proposal: FixProposal): string => hash(JSON.stringify(canonicalProposal(proposal)));
const canonicalReview = (proposals: readonly FixProposal[], inputDigest: string, policyDigest: string) => ({ schemaVersion: 2, proposals: proposals.map(canonicalProposal), proposalIds: proposals.map(proposalId), inputDigest, policyDigest });
export const reviewSetDigest = (review: Pick<GenericReviewSet, 'proposals' | 'inputDigest' | 'policyDigest'>): string => hash(JSON.stringify(canonicalReview(review.proposals, review.inputDigest, review.policyDigest)));

export function createReviewSet(proposals: readonly FixProposal[], inputDigest: string, policyDigest: string, notes = ''): GenericReviewSet {
  if (!proposals.length) throw new GenericReviewRejected('EMPTY_REVIEW_SET');
  const ordered = [...proposals].sort((a, b) => a.sourcePath.localeCompare(b.sourcePath, 'en') || proposalId(a).localeCompare(proposalId(b), 'en'));
  const ids = ordered.map(proposalId);
  if (new Set(ids).size !== ids.length) throw new GenericReviewRejected('DUPLICATE_PROPOSAL');
  const sourceDigests = Object.fromEntries([...new Map(ordered.map(proposal => [proposal.sourcePath, proposal.sourceDigest]))].sort(([a], [b]) => a.localeCompare(b, 'en')));
  return Object.freeze({ reviewSetId: hash(JSON.stringify(canonicalReview(ordered, inputDigest, policyDigest))), schemaVersion: 2, proposals: Object.freeze(ordered), proposalIds: Object.freeze(ids), sourceDigests, inputDigest, policyDigest, status: 'Draft', reviewerNotes: notes });
}

function assertCurrent(review: GenericReviewSet): void {
  const current = createReviewSet(review.proposals, review.inputDigest, review.policyDigest, review.reviewerNotes);
  if (current.reviewSetId !== review.reviewSetId || JSON.stringify(current.proposalIds) !== JSON.stringify(review.proposalIds)) throw new GenericReviewRejected('STALE_REVIEW_SET');
}

export function markReadyForReview(review: GenericReviewSet, reviewerNotes: string): GenericReviewSet {
  assertCurrent(review);
  if (!reviewerNotes.trim()) throw new GenericReviewRejected('REVIEW_NOTES_REQUIRED');
  return Object.freeze({ ...review, status: 'Ready for Review', reviewerNotes });
}

export function approveReviewSet(review: GenericReviewSet, reviewerNotes = review.reviewerNotes): GenericApproval {
  assertCurrent(review);
  if (review.status !== 'Ready for Review') throw new GenericReviewRejected('READY_FOR_REVIEW_REQUIRED');
  if (!reviewerNotes.trim()) throw new GenericReviewRejected('REVIEW_NOTES_REQUIRED');
  return Object.freeze({ reviewSetId: review.reviewSetId, proposalIds: Object.freeze([...review.proposalIds]), reviewSetDigest: reviewSetDigest(review), status: 'Approved', approvedAt: new Date().toISOString(), reviewerNotes });
}

export function rejectReviewSet(review: GenericReviewSet, rejectionReason: string): GenericReviewSet {
  assertCurrent(review);
  if (!rejectionReason.trim()) throw new GenericReviewRejected('REJECTION_REASON_REQUIRED');
  return Object.freeze({ ...review, status: 'Rejected', rejectionReason });
}

export function assertApprovalCurrent(approval: GenericApproval, review: GenericReviewSet): void {
  assertCurrent(review);
  if (approval.status !== 'Approved' || approval.reviewSetId !== review.reviewSetId || approval.reviewSetDigest !== reviewSetDigest(review) || JSON.stringify(approval.proposalIds) !== JSON.stringify(review.proposalIds) || review.status !== 'Ready for Review') throw new GenericReviewRejected('STALE_OR_INVALID_APPROVAL');
}

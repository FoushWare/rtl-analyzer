import type { ReviewRecord } from './review-session.js';

export function recoverCandidateSessionId(
  input: Pick<ReviewRecord, 'candidateSessionId'>,
  current: Pick<ReviewRecord, 'candidateSessionId'> | null,
): string {
  if (input.candidateSessionId && current?.candidateSessionId && input.candidateSessionId !== current.candidateSessionId) {
    throw new Error('CANDIDATE_SESSION_MISMATCH');
  }
  const candidateSessionId = input.candidateSessionId ?? current?.candidateSessionId;
  if (!candidateSessionId) throw new Error('HEALTHY_CANDIDATE_REQUIRED');
  return candidateSessionId;
}

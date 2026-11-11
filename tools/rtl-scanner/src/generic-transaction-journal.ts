import { createHash } from 'node:crypto';
import type { GenericAuthorization } from './generic-authorization.js';
import { createPersistedRecord, type PersistedRecord } from './generic-persistence.js';

export type GenericTransactionState = 'Prepared' | 'Applying' | 'Applied' | 'Rollback Requested' | 'Rolling Back' | 'Failed' | 'Recovery Required' | 'Rolled Back';
const transitions: Record<GenericTransactionState, readonly GenericTransactionState[]> = { Prepared: ['Applying', 'Failed'], Applying: ['Applied', 'Failed', 'Recovery Required'], Applied: ['Rollback Requested', 'Recovery Required'], 'Rollback Requested': ['Rolling Back', 'Failed', 'Recovery Required'], 'Rolling Back': ['Rolling Back', 'Rolled Back', 'Failed', 'Recovery Required'], Failed: ['Recovery Required'], 'Recovery Required': ['Rollback Requested', 'Rolling Back', 'Failed'], 'Rolled Back': [] };
export interface JournalFile { readonly path: string; readonly sourceDigest: string; readonly candidateDigest: string; readonly editSetDigest: string; readonly order: number; readonly state?: 'Pending' | 'Applied' | 'Rolled Back' }
export interface GenericTransactionJournal extends PersistedRecord { readonly kind: 'generic-transaction'; readonly transactionId: string; readonly projectIdentityDigest: string; readonly reviewSetId: string; readonly reviewSetDigest: string; readonly state: GenericTransactionState; readonly files: readonly JournalFile[]; readonly schemaVersion: 2 }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createTransactionJournal(auth: GenericAuthorization, files: readonly JournalFile[]): GenericTransactionJournal {
  const ordered = [...files].sort((a, b) => a.path.localeCompare(b.path, 'en') || a.order - b.order).map((file, order) => ({ ...file, order }));
  const transactionId = hash({ authorizationId: auth.authorizationId, files: ordered });
  return createPersistedRecord({ id: transactionId, kind: 'generic-transaction', formatVersion: 1, transactionId, projectIdentityDigest: auth.projectIdentityDigest, reviewSetId: auth.reviewSetId, reviewSetDigest: auth.reviewSetDigest, state: 'Prepared', files: ordered, schemaVersion: 2 }) as GenericTransactionJournal;
}
export function transitionTransaction(journal: GenericTransactionJournal, state: GenericTransactionState): GenericTransactionJournal {
  if (!transitions[journal.state].includes(state)) throw new Error('INVALID_TRANSACTION_TRANSITION');
  const id = journal.id.includes(':rollback:progress') ? `${journal.transactionId}:${state}:${hash(journal.files)}` : `${journal.transactionId}:${state}`;
  return createPersistedRecord({ ...journal, id, state, integritySha256: undefined } as never) as GenericTransactionJournal;
}

import { access, mkdir, readFile, rename, lstat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import type { ReviewIdentity, ReviewRecord, ReviewStatus } from './review-session.js';
import { reviewRecordKey, reviewStatusTransitions, validateReviewIdentity, validateReviewRecordShape } from './review-session.js';

export const REVIEW_STORE_VERSION = 1 as const;
export const DEFAULT_REVIEW_STORE_PATH = process.env.RTL_REVIEW_STORE_PATH || join(homedir(), '.rtl-migration-analyzer', 'review-records-v1.json');
export type MigrationTreatment = 'Automated' | 'Assisted' | 'Manual';
export interface MigrationDecisionHistory { readonly selectedTreatment: MigrationTreatment; readonly overrideReason?: string; readonly timestamp: string }
export interface MigrationDecision extends ReviewIdentity { readonly sourceDigest: string; readonly recommendation: MigrationTreatment; readonly recommendationRationale: string; readonly eligibilityConstraints: readonly string[]; readonly blockers: readonly string[]; readonly selectedTreatment: MigrationTreatment; readonly overrideReason?: string; readonly timestamp: string; readonly history: readonly MigrationDecisionHistory[] }
export interface ReviewStoreFile { formatVersion: 1; records: ReviewRecord[]; decisions?: MigrationDecision[] }

const inside = (root: string, target: string) => { const value = relative(root, target); return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value)); };
async function rejectSymlinkPath(path: string): Promise<void> {
  const absolute = resolve(path); const root = parse(absolute).root; let cursor = root;
  const trustedAncestors = [resolve(tmpdir()), resolve(homedir())];
  for (const part of absolute.slice(root.length).split(sep).filter(Boolean)) { cursor = join(cursor, part); try { if ((await lstat(cursor)).isSymbolicLink() && !trustedAncestors.some(ancestor => inside(cursor, ancestor))) throw new Error('REVIEW_STORE_SYMLINK'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
}
function validateStorePath(path: string): string { const absolute = resolve(path); if (!isAbsolute(absolute) || !inside(dirname(absolute), absolute) || !absolute.endsWith(`${sep}review-records-v1.json`)) throw new Error('INVALID_REVIEW_STORE_PATH'); return absolute; }
function validateStoredRecord(record: unknown): ReviewRecord {
  if (!record || typeof record !== 'object') throw new Error('INVALID_REVIEW_RECORD');
  const value = record as ReviewRecord;
  validateReviewRecordShape(value);
  if (typeof value.timestamp !== 'string' || !Number.isFinite(Date.parse(value.timestamp))) throw new Error('INVALID_REVIEW_TIMESTAMP');
  return { ...value, evidenceReferences: [...value.evidenceReferences] };
}
const treatments: readonly MigrationTreatment[] = ['Automated', 'Assisted', 'Manual'];
function validateDecisionShape(input: Omit<MigrationDecision, 'timestamp' | 'history'> & { timestamp?: string; history?: readonly MigrationDecisionHistory[] }): void {
  validateReviewIdentity(input); if (!/^[a-f0-9]{64}$/.test(input.sourceDigest)) throw new Error('INVALID_DECISION_SOURCE_DIGEST');
  if (!treatments.includes(input.recommendation) || !treatments.includes(input.selectedTreatment)) throw new Error('INVALID_MIGRATION_TREATMENT');
  if (typeof input.recommendationRationale !== 'string' || input.recommendationRationale.length > 4000 || !Array.isArray(input.eligibilityConstraints) || input.eligibilityConstraints.some(x => typeof x !== 'string' || x.length > 500) || !Array.isArray(input.blockers) || input.blockers.some(x => typeof x !== 'string' || x.length > 500)) throw new Error('INVALID_DECISION_METADATA');
  if (input.selectedTreatment !== input.recommendation && (!input.overrideReason || input.overrideReason.trim().length === 0 || input.overrideReason.length > 4000)) throw new Error('OVERRIDE_REASON_REQUIRED');
  if (input.selectedTreatment === 'Automated' && (input.recommendation !== 'Automated' || input.blockers.length > 0)) throw new Error('AUTOMATED_TREATMENT_NOT_ELIGIBLE');
  if (input.timestamp !== undefined && !Number.isFinite(Date.parse(input.timestamp))) throw new Error('INVALID_DECISION_TIMESTAMP');
  for (const item of input.history ?? []) if (!treatments.includes(item.selectedTreatment) || !Number.isFinite(Date.parse(item.timestamp))) throw new Error('INVALID_DECISION_HISTORY');
}
function validateStoredDecision(decision: unknown): MigrationDecision { if (!decision || typeof decision !== 'object') throw new Error('INVALID_MIGRATION_DECISION'); const value = decision as MigrationDecision; validateDecisionShape(value); if (typeof value.timestamp !== 'string' || !Number.isFinite(Date.parse(value.timestamp))) throw new Error('INVALID_DECISION_TIMESTAMP'); return { ...value, eligibilityConstraints: [...value.eligibilityConstraints], blockers: [...value.blockers], history: [...value.history] }; }

export class ReviewRecordStore {
  readonly path: string;
  private records = new Map<string, ReviewRecord>();
  private decisions = new Map<string, MigrationDecision>();
  private loaded = false;
  private error: string | null = null;
  constructor(path = DEFAULT_REVIEW_STORE_PATH) { this.path = validateStorePath(path); }
  get loadError(): string | null { return this.error; }
  get isLoaded(): boolean { return this.loaded; }
  async load(): Promise<void> {
    await rejectSymlinkPath(dirname(this.path));
    try { const raw = JSON.parse(await readFile(this.path, 'utf8')) as Partial<ReviewStoreFile>; if (raw.formatVersion !== REVIEW_STORE_VERSION || !Array.isArray(raw.records) || (raw.decisions !== undefined && !Array.isArray(raw.decisions))) throw new Error('INCOMPATIBLE_REVIEW_STORE'); const next = new Map<string, ReviewRecord>(); for (const item of raw.records) { const record = validateStoredRecord(item); const key = reviewRecordKey(record); if (next.has(key)) throw new Error('DUPLICATE_REVIEW_RECORD'); next.set(key, record); } const nextDecisions = new Map<string, MigrationDecision>(); for (const item of raw.decisions ?? []) { const decision = validateStoredDecision(item); const key = reviewRecordKey(decision); if (nextDecisions.has(key)) throw new Error('DUPLICATE_MIGRATION_DECISION'); nextDecisions.set(key, decision); } this.records = next; this.decisions = nextDecisions; this.error = null; this.loaded = true; }
    catch (error) { const code = (error as NodeJS.ErrnoException).code; if (code === 'ENOENT') { this.records.clear(); this.error = null; this.loaded = true; return; } this.records.clear(); this.error = error instanceof Error ? error.message : 'REVIEW_STORE_LOAD_FAILED'; this.loaded = true; }
  }
  get(identity: ReviewIdentity): ReviewRecord | null { validateReviewIdentity(identity); return this.records.get(reviewRecordKey(identity)) ?? null; }
  getDecision(identity: ReviewIdentity): MigrationDecision | null { validateReviewIdentity(identity); return this.decisions.get(reviewRecordKey(identity)) ?? null; }
  async saveDecision(input: Omit<MigrationDecision, 'timestamp' | 'history'> & { timestamp?: string; history?: readonly MigrationDecisionHistory[] }): Promise<MigrationDecision> { if (!this.loaded) throw new Error('REVIEW_STORE_NOT_LOADED'); if (this.error) throw new Error(`REVIEW_STORE_UNAVAILABLE:${this.error}`); validateDecisionShape(input); const key = reviewRecordKey(input); const previous = this.decisions.get(key); const record: MigrationDecision = { ...input, timestamp: input.timestamp ?? new Date().toISOString(), history: input.history ? [...input.history] : previous ? [...previous.history, { selectedTreatment: previous.selectedTreatment, ...(previous.overrideReason ? { overrideReason: previous.overrideReason } : {}), timestamp: previous.timestamp }] : [], eligibilityConstraints: [...input.eligibilityConstraints], blockers: [...input.blockers] }; this.decisions.set(key, record); try { await this.persist(); return record; } catch (error) { if (previous) this.decisions.set(key, previous); else this.decisions.delete(key); throw error; } }
  save(input: Omit<ReviewRecord, 'timestamp'> & { timestamp?: string }): ReviewRecord {
    if (!this.loaded) throw new Error('REVIEW_STORE_NOT_LOADED'); if (this.error) throw new Error(`REVIEW_STORE_UNAVAILABLE:${this.error}`); validateReviewRecordShape(input); const key = reviewRecordKey(input); const current = this.records.get(key); const previous = current?.status ?? 'Not Reviewed'; if (input.status !== previous && !reviewStatusTransitions[previous].includes(input.status as ReviewStatus)) throw new Error('INVALID_REVIEW_TRANSITION'); const record: ReviewRecord = { ...input, timestamp: input.timestamp ?? new Date().toISOString(), evidenceReferences: [...input.evidenceReferences] }; this.records.set(key, record); return record;
  }
  async persist(): Promise<void> {
    if (!this.loaded) throw new Error('REVIEW_STORE_NOT_LOADED'); if (this.error) throw new Error(`REVIEW_STORE_UNAVAILABLE:${this.error}`); const parent = dirname(this.path); await rejectSymlinkPath(parent); await mkdir(parent, { recursive: true, mode: 0o700 }); await rejectSymlinkPath(parent); const temporary = join(parent, `.review-records-v1.${process.pid}.${Date.now()}.tmp`); const payload: ReviewStoreFile = { formatVersion: REVIEW_STORE_VERSION, records: [...this.records.values()], decisions: [...this.decisions.values()] }; try { await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); await rename(temporary, this.path); } catch (error) { try { await access(temporary, constants.F_OK); await rename(temporary, `${temporary}.failed`); } catch { /* preserve the original error */ } throw error; }
  }
  async saveAndPersist(input: Omit<ReviewRecord, 'timestamp'> & { timestamp?: string }): Promise<ReviewRecord> { const key = reviewRecordKey(input); const previous = this.records.get(key); const record = this.save(input); try { await this.persist(); return record; } catch (error) { if (previous) this.records.set(key, previous); else this.records.delete(key); throw error; } }
}

export const reviewStoreIsOutsideRepository = (path: string, repositoryRoot: string) => !inside(resolve(repositoryRoot), resolve(path));
export const reviewStoreTempRoot = tmpdir;

import { createHash, randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rename, lstat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import type { PatchRequest, ReviewIdentity, ReviewStatus } from './review-session.js';
import { validateReviewIdentity } from './review-session.js';

export const EVIDENCE_STORE_VERSION = 1 as const;
export const DEFAULT_EVIDENCE_STORE_PATH = process.env.RTL_EVIDENCE_STORE_PATH || join(homedir(), '.rtl-migration-analyzer', 'review-evidence-v1.json');
export interface EvidenceSnapshot extends ReviewIdentity {
  readonly snapshotId: string;
  readonly candidatePatchIdentity: { readonly path: string; readonly expectedSha256: string; readonly replacementSha256: string };
  readonly originalSourceSha256: string;
  readonly candidateSourceSha256: string;
  readonly codeDiff: string;
  readonly scannerBefore: { readonly findingPresent: boolean; readonly resultDigest: string };
  readonly scannerAfter: { readonly findingPresent: boolean; readonly resultDigest: string };
  readonly browserDomValidation: readonly string[];
  readonly screenshotReferences: readonly string[];
  readonly screenshotDigests?: readonly string[];
  readonly timestamp: string;
  readonly decision: Exclude<ReviewStatus, 'Not Reviewed' | 'Candidate Proposed' | 'Validation Failed'>;
  readonly supersedesSnapshotId?: string;
  readonly integritySha256: string;
  readonly patch?: PatchRequest;
}
export interface EvidenceStoreFile { formatVersion: 1; snapshots: EvidenceSnapshot[] }
const inside = (root: string, target: string) => { const value = relative(root, target); return value === '' || (value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value)); };
async function rejectSymlinkPath(path: string): Promise<void> { const absolute = resolve(path); const root = parse(absolute).root; let cursor = root; for (const part of absolute.slice(root.length).split(sep).filter(Boolean)) { cursor = join(cursor, part); try { if ((await lstat(cursor)).isSymbolicLink() && !inside(cursor, resolve(homedir())) && !inside(cursor, resolve(tmpdir()))) throw new Error('EVIDENCE_STORE_SYMLINK'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } } }
function validateStorePath(path: string): string { const absolute = resolve(path); if (!isAbsolute(absolute) || !absolute.endsWith(`${sep}review-evidence-v1.json`)) throw new Error('INVALID_EVIDENCE_STORE_PATH'); return absolute; }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const immutablePayload = (snapshot: Omit<EvidenceSnapshot, 'integritySha256'> | EvidenceSnapshot) => { const { integritySha256: _ignored, ...payload } = snapshot as EvidenceSnapshot; return payload; };
export function evidenceIntegrity(snapshot: Omit<EvidenceSnapshot, 'integritySha256'> | EvidenceSnapshot): string { return digest(immutablePayload(snapshot)); }
export function validateEvidenceSnapshot(snapshot: unknown): EvidenceSnapshot {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('INVALID_EVIDENCE_SNAPSHOT');
  const value = snapshot as EvidenceSnapshot;
  validateReviewIdentity(value);
  if (!value.snapshotId || typeof value.snapshotId !== 'string' || value.snapshotId.length > 100) throw new Error('INVALID_EVIDENCE_SNAPSHOT_ID');
  if (!value.candidatePatchIdentity || value.candidatePatchIdentity.path !== 'apps/invoicing/src/components/InvoiceTable.tsx') throw new Error('INVALID_EVIDENCE_PATCH_IDENTITY');
  if (value.patch && (value.patch.path !== value.sourcePath || value.patch.findingId !== value.findingId || !Number.isInteger(value.patch.startOffset) || !Number.isInteger(value.patch.endOffset) || value.patch.endOffset < value.patch.startOffset || value.patch.expectedSha256 !== value.candidatePatchIdentity.expectedSha256 || createHash('sha256').update(value.patch.replacement).digest('hex') !== value.candidatePatchIdentity.replacementSha256)) throw new Error('INVALID_EVIDENCE_PATCH');
  if (![value.candidatePatchIdentity.expectedSha256, value.candidatePatchIdentity.replacementSha256, value.originalSourceSha256, value.candidateSourceSha256].every(x => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x))) throw new Error('INVALID_EVIDENCE_DIGEST');
  if (typeof value.codeDiff !== 'string' || value.codeDiff.length > 100_000 || !value.scannerBefore || !value.scannerAfter || !Array.isArray(value.browserDomValidation) || !Array.isArray(value.screenshotReferences) || !Number.isFinite(Date.parse(value.timestamp)) || !['Verified Correct', 'Ready for Review', 'Approved', 'Rejected'].includes(value.decision)) throw new Error('INVALID_EVIDENCE_SNAPSHOT');
  for (const ref of [...value.browserDomValidation, ...value.screenshotReferences]) if (typeof ref !== 'string' || ref.length > 1000 || isAbsolute(ref) || ref.split(/[\\/]/).includes('..')) throw new Error('INVALID_EVIDENCE_REFERENCE');
  if (value.screenshotDigests !== undefined && (!Array.isArray(value.screenshotDigests) || value.screenshotDigests.length !== value.screenshotReferences.length || value.screenshotDigests.some(x => typeof x !== 'string' || !/^[a-f0-9]{64}$/.test(x)))) throw new Error('INVALID_SCREENSHOT_DIGESTS');
  if (value.supersedesSnapshotId !== undefined && (typeof value.supersedesSnapshotId !== 'string' || value.supersedesSnapshotId.length > 100)) throw new Error('INVALID_SUPERSEDES_SNAPSHOT_ID');
  if (value.integritySha256 !== evidenceIntegrity(value)) throw new Error('EVIDENCE_INTEGRITY_MISMATCH');
  return { ...value, browserDomValidation: [...value.browserDomValidation], screenshotReferences: [...value.screenshotReferences] };
}
export class EvidenceSnapshotStore {
  readonly path: string; private snapshots = new Map<string, EvidenceSnapshot>(); private loaded = false; private error: string | null = null;
  constructor(path = DEFAULT_EVIDENCE_STORE_PATH) { this.path = validateStorePath(path); }
  get loadError(): string | null { return this.error; }
  async load(): Promise<void> { await rejectSymlinkPath(dirname(this.path)); try { const raw = JSON.parse(await readFile(this.path, 'utf8')) as EvidenceStoreFile; if (raw.formatVersion !== EVIDENCE_STORE_VERSION || !Array.isArray(raw.snapshots)) throw new Error('INCOMPATIBLE_EVIDENCE_STORE'); const next = new Map<string, EvidenceSnapshot>(); for (const item of raw.snapshots) { const snapshot = validateEvidenceSnapshot(item); if (next.has(snapshot.snapshotId)) throw new Error('DUPLICATE_EVIDENCE_SNAPSHOT'); next.set(snapshot.snapshotId, snapshot); } this.snapshots = next; this.error = null; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') { this.snapshots.clear(); this.error = null; } else { this.snapshots.clear(); this.error = error instanceof Error ? error.message : 'EVIDENCE_STORE_LOAD_FAILED'; } } this.loaded = true; }
  list(identity: ReviewIdentity): EvidenceSnapshot[] { validateReviewIdentity(identity); return [...this.snapshots.values()].filter(x => x.findingId === identity.findingId && x.sourcePath === identity.sourcePath && x.inputDigest === identity.inputDigest && x.policyDigest === identity.policyDigest && x.schemaVersion === identity.schemaVersion); }
  async append(input: Omit<EvidenceSnapshot, 'snapshotId' | 'integritySha256'> & { snapshotId?: string }): Promise<EvidenceSnapshot> { if (!this.loaded || this.error) throw new Error(`EVIDENCE_STORE_UNAVAILABLE${this.error ? `:${this.error}` : ''}`); const snapshot = { ...input, snapshotId: input.snapshotId ?? randomUUID(), integritySha256: '' } as Omit<EvidenceSnapshot, 'integritySha256'>; const complete = { ...snapshot, integritySha256: evidenceIntegrity(snapshot) }; validateEvidenceSnapshot(complete); if (this.snapshots.has(complete.snapshotId)) throw new Error('EVIDENCE_SNAPSHOT_IMMUTABLE'); this.snapshots.set(complete.snapshotId, complete); try { await this.persist(); return complete; } catch (error) { this.snapshots.delete(complete.snapshotId); throw error; } }
  async appendApproval(snapshotId: string): Promise<EvidenceSnapshot> { const source = this.snapshots.get(snapshotId); if (!source) throw new Error('EVIDENCE_SNAPSHOT_NOT_FOUND'); if (source.decision === 'Approved') return source; if (source.decision !== 'Ready for Review') throw new Error('EVIDENCE_NOT_APPROVABLE'); const { snapshotId: _old, integritySha256: _integrity, ...payload } = source; return this.append({ ...payload, decision: 'Approved', supersedesSnapshotId: source.snapshotId }); }
  private async persist(): Promise<void> { const parent = dirname(this.path); await rejectSymlinkPath(parent); await mkdir(parent, { recursive: true, mode: 0o700 }); const temporary = join(parent, `.review-evidence-v1.${process.pid}.${Date.now()}.tmp`); try { await writeFile(temporary, `${JSON.stringify({ formatVersion: EVIDENCE_STORE_VERSION, snapshots: [...this.snapshots.values()] }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); await rename(temporary, this.path); } catch (error) { try { await access(temporary, constants.F_OK); await rename(temporary, `${temporary}.failed`); } catch { /* preserve failure */ } throw error; } }
}

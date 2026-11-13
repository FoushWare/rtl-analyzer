import { createHash, randomUUID } from 'node:crypto';
import { access, lstat, mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { validateEvidenceSnapshot, type EvidenceSnapshot } from './evidence-store.js';
import type { ReviewIdentity, ReviewRecord, PatchRequest } from './review-session.js';
import { validateReviewIdentity, validateReviewPath, validatePatch, REVIEW_SOURCE } from './review-session.js';
import { assertSecureFileAccessSupported, openSecureRead } from './secure-file-access.js';

export const APPLY_CONFIRMATION = 'APPLY_CONFIRMED';
export interface ApplyAuthorization { identity: ReviewIdentity; reviewRecord: ReviewRecord; evidence: readonly EvidenceSnapshot[]; patch: PatchRequest; confirmation: string }
export interface ApplyReceipt { auditId: string; path: string; originalSha256: string; appliedSha256: string; backupPath: string; appliedAt: string }
export interface ApplyAuditEvent { auditId: string; type: 'APPLIED' | 'ROLLED_BACK' | 'APPLY_FAILED' | 'ROLLBACK_FAILED'; path: string; sourceSha256: string; resultingSha256?: string; backupPath?: string; timestamp: string; reason?: string }
const active = new Set<string>();
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const readNoFollow = async (path: string): Promise<string> => { const handle = await openSecureRead(path); try { return await handle.readFile('utf8'); } finally { await handle.close(); } };
const atomicWrite = async (path: string, content: string): Promise<void> => { const temporary = `${path}.rtl-apply.${process.pid}.${randomUUID()}.tmp`; try { await writeFile(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 }); await rename(temporary, path); } catch (error) { try { await access(temporary, constants.F_OK); await rename(temporary, `${temporary}.failed`); } catch { /* preserve original error */ } throw error; } };

export class ApplyAuditStore {
  constructor(readonly path: string) {}
  async list(): Promise<ApplyAuditEvent[]> { try { return JSON.parse(await readFile(this.path, 'utf8')) as ApplyAuditEvent[]; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw new Error('APPLY_AUDIT_UNREADABLE'); } }
  async append(event: ApplyAuditEvent): Promise<void> { const parent = dirname(this.path); await mkdir(parent, { recursive: true, mode: 0o700 }); const events = await this.list(); events.push(event); await atomicWrite(this.path, `${JSON.stringify(events, null, 2)}\n`); }
}

export class ControlledApplyService {
  constructor(private readonly repositoryRoot: string, private readonly audit = new ApplyAuditStore(process.env.RTL_AUDIT_STORE_PATH || join(homedir(), '.rtl-migration-analyzer', 'apply-audit-v1.json')), private readonly backupRoot = process.env.RTL_APPLY_BACKUP_ROOT || join(tmpdir(), 'rtl-migration-analyzer-apply-backups')) {}
  async recoverRollbackReceipt(pathValue: string, originalSha256: string, appliedSha256: string): Promise<ApplyReceipt | null> {
    const path = validateReviewPath(this.repositoryRoot, pathValue); const events = await this.audit.list(); const applied = [...events].reverse().find(event => event.type === 'APPLIED' && event.path === pathValue && event.sourceSha256 === originalSha256 && event.resultingSha256 === appliedSha256 && event.backupPath);
    if (!applied?.backupPath || events.some(event => event.auditId === applied.auditId && event.type === 'ROLLED_BACK')) return null;
    const current = await readNoFollow(path); if (sha(current) !== appliedSha256) return null;
    const backup = await readFile(applied.backupPath, 'utf8'); if (sha(backup) !== originalSha256) return null;
    return { auditId: applied.auditId, path: pathValue, originalSha256, appliedSha256, backupPath: applied.backupPath, appliedAt: applied.timestamp };
  }
  async apply(auth: ApplyAuthorization): Promise<ApplyReceipt> {
    assertSecureFileAccessSupported();
    validateReviewIdentity(auth.identity);
    if (auth.confirmation !== APPLY_CONFIRMATION) throw new Error('APPLY_CONFIRMATION_REQUIRED');
    if (auth.reviewRecord.status !== 'Approved' || auth.reviewRecord.findingId !== auth.identity.findingId || auth.reviewRecord.inputDigest !== auth.identity.inputDigest || auth.reviewRecord.policyDigest !== auth.identity.policyDigest) throw new Error('APPROVED_REVIEW_REQUIRED');
    if (auth.patch.path !== REVIEW_SOURCE || auth.patch.findingId !== auth.identity.findingId) throw new Error('APPLY_PATCH_IDENTITY_MISMATCH');
    const evidence = auth.evidence.find(x => { try { validateEvidenceSnapshot(x); } catch { return false; } return x.findingId === auth.identity.findingId && x.sourcePath === auth.identity.sourcePath && x.inputDigest === auth.identity.inputDigest && x.policyDigest === auth.identity.policyDigest && (x.decision === 'Approved' || x.decision === 'Ready for Review') && x.candidatePatchIdentity.expectedSha256 === auth.patch.expectedSha256 && x.candidatePatchIdentity.replacementSha256 === sha(auth.patch.replacement) && !x.scannerAfter.findingPresent && x.browserDomValidation.length > 0; });
    if (!evidence) throw new Error('VALIDATION_EVIDENCE_REQUIRED');
    const path = validateReviewPath(this.repositoryRoot, auth.patch.path); const key = path; if (active.has(key)) throw new Error('APPLY_IN_PROGRESS'); active.add(key);
    try { const stat = await lstat(path); if (!stat.isFile()) throw new Error('APPLY_SOURCE_NOT_REGULAR_FILE'); const original = await readNoFollow(path); const originalSha256 = sha(original); if (originalSha256 !== evidence.originalSourceSha256) throw new Error('STALE_APPLY_SOURCE'); validatePatch(original, auth.patch); const next = original.slice(0, auth.patch.startOffset) + auth.patch.replacement + original.slice(auth.patch.endOffset); const appliedSha256 = sha(next); if (appliedSha256 !== evidence.candidateSourceSha256) throw new Error('APPLY_RESULT_MISMATCH'); await mkdir(this.backupRoot, { recursive: true, mode: 0o700 }); const backupPath = join(this.backupRoot, `${randomUUID()}.bak`); await writeFile(backupPath, original, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); if (sha(await readFile(backupPath, 'utf8')) !== originalSha256) throw new Error('APPLY_BACKUP_MISMATCH'); const auditId = randomUUID(); try { await atomicWrite(path, next); } catch (error) { await this.audit.append({ auditId, type: 'APPLY_FAILED', path: auth.patch.path, sourceSha256: originalSha256, timestamp: new Date().toISOString(), reason: 'ATOMIC_WRITE_FAILED' }); throw error; } try { await this.audit.append({ auditId, type: 'APPLIED', path: auth.patch.path, sourceSha256: originalSha256, resultingSha256: appliedSha256, backupPath, timestamp: new Date().toISOString() }); } catch (error) { await atomicWrite(path, original); throw new Error('APPLY_AUDIT_FAILED'); } return { auditId, path: auth.patch.path, originalSha256, appliedSha256, backupPath, appliedAt: new Date().toISOString() }; } finally { active.delete(key); }
  }
  async rollback(receipt: ApplyReceipt): Promise<void> { const path = validateReviewPath(this.repositoryRoot, receipt.path); const key = path; if (active.has(key)) throw new Error('APPLY_IN_PROGRESS'); active.add(key); try { const current = await readNoFollow(path); if (sha(current) !== receipt.appliedSha256) { await this.audit.append({ auditId: receipt.auditId, type: 'ROLLBACK_FAILED', path: receipt.path, sourceSha256: receipt.originalSha256, resultingSha256: sha(current), timestamp: new Date().toISOString(), reason: 'CURRENT_SOURCE_CHANGED' }); throw new Error('ROLLBACK_CONFLICT'); } const backup = await readFile(receipt.backupPath, 'utf8'); if (sha(backup) !== receipt.originalSha256) throw new Error('ROLLBACK_BACKUP_MISMATCH'); await atomicWrite(path, backup); await this.audit.append({ auditId: receipt.auditId, type: 'ROLLED_BACK', path: receipt.path, sourceSha256: receipt.appliedSha256, resultingSha256: receipt.originalSha256, backupPath: receipt.backupPath, timestamp: new Date().toISOString() }); } finally { active.delete(key); } }
}

import { createHash, randomUUID } from 'node:crypto';
import { cp, lstat, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';

export const REVIEW_SOURCE = 'apps/invoicing/src/components/InvoiceTable.tsx';
export const REVIEW_FINDING_ID = 'RTL.ICON.PROGRESSION:237172da962fe4d0605ddd83';
export type ReviewState = 'Not Reviewed' | 'Candidate Proposed' | 'Validation Failed' | 'Ready for Review' | 'Approved' | 'Rejected';
export type ReviewStatus = 'Not Reviewed' | 'Needs Manual Investigation' | 'Verified Correct' | 'Candidate Proposed' | 'Validation Failed' | 'Ready for Review' | 'Approved' | 'Rejected';
export type ReviewClassification = 'Manual' | 'Assisted' | 'Automated / Codemod Eligible';
export interface ReviewIdentity { findingId: string; sourcePath: string; inputDigest: string; policyDigest: string; schemaVersion: number }
export interface ReviewRecord extends ReviewIdentity { status: ReviewStatus; reviewerNotes: string; evidenceReferences: readonly string[]; candidateSessionId?: string; timestamp: string }
export interface PatchRequest { findingId: string; path: string; startOffset: number; endOffset: number; expectedSha256: string; replacement: string }
export interface ReviewSession { id: string; root: string; candidateRoot: string; sourcePath: string; state: ReviewState; classification: ReviewClassification; originalSha256: string; candidateSha256?: string; createdAt: string; runtime?: { port: number; origin: string; status: 'starting'|'healthy'|'stopped'|'failed'; error?: string } }
export const CANDIDATE_PORT = 4202;
export const CANDIDATE_ORIGIN = `http://127.0.0.1:${CANDIDATE_PORT}`;
export function runtimeCacheDir(root: string, role: 'original' | 'candidate'): string { return join(resolve(root), '.rtl-vite-cache', role); }
const runtimes = new Map<string, ChildProcess>();
const reviewRecords = new Map<string, ReviewRecord>();

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const recordKey = (identity: ReviewIdentity) => `${identity.findingId}|${identity.sourcePath}|${identity.inputDigest}|${identity.policyDigest}|${identity.schemaVersion}`;
export const reviewStatusTransitions: Record<ReviewStatus, readonly ReviewStatus[]> = {
  'Not Reviewed': ['Needs Manual Investigation', 'Verified Correct', 'Candidate Proposed'],
  'Needs Manual Investigation': ['Verified Correct', 'Candidate Proposed', 'Rejected'],
  'Verified Correct': ['Needs Manual Investigation'],
  'Candidate Proposed': ['Validation Failed', 'Ready for Review', 'Needs Manual Investigation'],
  'Validation Failed': ['Candidate Proposed', 'Needs Manual Investigation'],
  'Ready for Review': ['Approved', 'Rejected', 'Needs Manual Investigation'],
  'Approved': ['Rejected', 'Needs Manual Investigation'],
  'Rejected': ['Candidate Proposed', 'Needs Manual Investigation'],
};
export function reviewRecordKey(identity: ReviewIdentity): string { return recordKey(identity); }
export function validateReviewIdentity(identity: ReviewIdentity): void { if (!identity || typeof identity.findingId !== 'string' || !identity.findingId.trim() || identity.findingId.length > 500 || typeof identity.sourcePath !== 'string' || !identity.sourcePath || isAbsolute(identity.sourcePath) || normalize(identity.sourcePath) !== identity.sourcePath || identity.sourcePath.split(/[\\/]/).includes('..') || identity.schemaVersion !== 2 || !identity.inputDigest || !identity.policyDigest) throw new Error('INVALID_REVIEW_IDENTITY'); }
export function validateReviewRecordShape(input: Omit<ReviewRecord, 'timestamp'> & { timestamp?: string }): void { validateReviewIdentity(input); if (!Object.prototype.hasOwnProperty.call(input, 'status') || !reviewStatusTransitions[input.status]) throw new Error('INVALID_REVIEW_STATUS'); if (typeof input.reviewerNotes !== 'string' || input.reviewerNotes.length > 4000 || !Array.isArray(input.evidenceReferences) || input.evidenceReferences.length > 50 || input.evidenceReferences.some(reference => typeof reference !== 'string' || reference.length > 500)) throw new Error('REVIEW_EVIDENCE_TOO_LARGE'); if (input.candidateSessionId !== undefined && (typeof input.candidateSessionId !== 'string' || input.candidateSessionId.length > 100)) throw new Error('INVALID_CANDIDATE_SESSION_ID'); if (input.timestamp !== undefined && (!Number.isFinite(Date.parse(input.timestamp)))) throw new Error('INVALID_REVIEW_TIMESTAMP'); }
export function getReviewRecord(identity: ReviewIdentity): ReviewRecord | null { validateReviewIdentity(identity); return reviewRecords.get(recordKey(identity)) ?? null; }
export function saveReviewRecord(input: Omit<ReviewRecord, 'timestamp'> & { timestamp?: string }): ReviewRecord {
  validateReviewRecordShape(input);
  const key = recordKey(input); const current = reviewRecords.get(key); const previous = current?.status ?? 'Not Reviewed';
  if (input.status !== previous && !reviewStatusTransitions[previous].includes(input.status)) throw new Error('INVALID_REVIEW_TRANSITION');
  const record = { ...input, timestamp: input.timestamp ?? new Date().toISOString() };
  reviewRecords.set(key, record); return record;
}
export function clearReviewRecords(): void { reviewRecords.clear(); }
const inside = (root: string, target: string) => { const r = relative(root, target); return r === '' || (r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r)); };
export function validateReviewPath(root: string, path: string): string {
  if (!path || isAbsolute(path) || normalize(path) !== path || path.split(/[\\/]/).includes('..')) throw new Error('INVALID_REVIEW_PATH');
  const target = resolve(root, path);
  if (!inside(resolve(root), target) || path !== REVIEW_SOURCE) throw new Error('REVIEW_SOURCE_NOT_ALLOWED');
  return target;
}
export async function validateProjectSourcePath(root: string, path: string): Promise<string> {
  if (!path || isAbsolute(path) || normalize(path) !== path || path.split(/[\\/]/).includes('..')) throw new Error('INVALID_REVIEW_PATH');
  const canonicalRoot = await realpath(resolve(root));
  const target = resolve(canonicalRoot, path);
  if (!inside(canonicalRoot, target)) throw new Error('REVIEW_SOURCE_NOT_ALLOWED');
  let canonicalTarget: string;
  try { canonicalTarget = await realpath(target); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('PROJECT_SOURCE_UNAVAILABLE'); throw error; }
  if (!inside(canonicalRoot, canonicalTarget)) throw new Error('REVIEW_SOURCE_NOT_ALLOWED');
  return canonicalTarget;
}
export function validatePatch(text: string, patch: PatchRequest): void {
  if (!patch.findingId || patch.path !== REVIEW_SOURCE) throw new Error('REVIEW_FINDING_NOT_ALLOWED');
  if (!Number.isInteger(patch.startOffset) || !Number.isInteger(patch.endOffset) || patch.startOffset < 0 || patch.endOffset < patch.startOffset || patch.endOffset > text.length) throw new Error('INVALID_REVIEW_RANGE');
  if (digest(text.slice(patch.startOffset, patch.endOffset)) !== patch.expectedSha256) throw new Error('STALE_REVIEW_SOURCE');
}
export async function createReviewSession(root: string): Promise<ReviewSession> {
  const source = validateReviewPath(root, REVIEW_SOURCE);
  const sourceStat = await lstat(source);
  if (!sourceStat.isFile()) throw new Error('REVIEW_SOURCE_NOT_REGULAR_FILE');
  const candidateRoot = await mkdtemp(join(tmpdir(), 'rtl-review-'));
  try {
    const allowedTopLevel = new Set(['apps', 'libs', 'package.json', 'package-lock.json', 'nx.json', 'tsconfig.json', 'tsconfig.base.json', 'vite.config.ts', 'playwright.config.ts']);
    await cp(root, candidateRoot, { recursive: true, dereference: false, filter: (sourcePath) => { const relativePath = sourcePath.slice(root.length + 1); const top = relativePath.split('/')[0] ?? ''; return relativePath === '' || allowedTopLevel.has(top); } });
    const copied = validateReviewPath(candidateRoot, REVIEW_SOURCE);
    const text = await readFile(copied, 'utf8');
    return { id: randomUUID(), root: resolve(root), candidateRoot, sourcePath: REVIEW_SOURCE, state: 'Candidate Proposed', classification: 'Manual', originalSha256: digest(text), createdAt: new Date().toISOString() };
  } catch (error) { await rm(candidateRoot, { recursive: true, force: true }); throw error; }
}
export async function applyReviewPatch(session: ReviewSession, patch: PatchRequest): Promise<ReviewSession> {
  const target = validateReviewPath(session.candidateRoot, patch.path);
  const text = await readFile(target, 'utf8');
  validatePatch(text, patch);
  const next = text.slice(0, patch.startOffset) + patch.replacement + text.slice(patch.endOffset);
  await writeFile(target, next, 'utf8');
  return { ...session, state: 'Candidate Proposed', candidateSha256: digest(next) };
}
export async function reviewSessionDiff(session: ReviewSession): Promise<string> {
  const original = await readFile(validateReviewPath(session.root, REVIEW_SOURCE), 'utf8');
  const candidate = await readFile(validateReviewPath(session.candidateRoot, REVIEW_SOURCE), 'utf8');
  if (original === candidate) return 'No candidate changes applied.';
  const originalLine = original.split(/\r?\n/).find(line => line.includes('{i.id}')) ?? '';
  const candidateLine = candidate.split(/\r?\n/).find(line => line.includes('{i.id}')) ?? '';
  return `--- ${REVIEW_SOURCE} (original)\n+++ ${REVIEW_SOURCE} (candidate)\n@@\n- ${originalLine}\n+ ${candidateLine}`;
}
function health(origin: string, port: number): Promise<boolean> { return new Promise(resolveHealth => { const request = httpRequest(`${origin}/invoices`, { method: 'GET', host: '127.0.0.1', port, path: '/invoices', timeout: 1000 }, response => { response.resume(); resolveHealth(Boolean(response.statusCode && response.statusCode < 500)); }); request.on('error', () => resolveHealth(false)); request.on('timeout', () => { request.destroy(); resolveHealth(false); }); request.end(); }); }
export async function assertPortAvailable(port: number = CANDIDATE_PORT): Promise<void> { if (await health(`http://127.0.0.1:${port}`, port)) throw new Error('CANDIDATE_PORT_OCCUPIED'); }
export async function startCandidateRuntime(session: ReviewSession): Promise<ReviewSession> {
  if (runtimes.has(session.id)) return { ...session, runtime: { port: CANDIDATE_PORT, origin: CANDIDATE_ORIGIN, status: 'healthy' } };
  await assertPortAvailable();
  const viteBin = join(session.root, 'node_modules/vite/bin/vite.js');
  const dependencyMount = join(session.candidateRoot, 'node_modules');
  await symlink(join(session.root, 'node_modules'), dependencyMount, 'dir');
  const candidateConfig = join(session.candidateRoot, 'apps/invoicing/vite.config.ts');
  const child = spawn(process.execPath, [viteBin, '--config', candidateConfig, '--host', '127.0.0.1', '--port', String(CANDIDATE_PORT), '--strictPort'], { cwd: session.root, env: { ...process.env, NODE_PATH: join(session.root, 'node_modules'), RTL_VITE_CACHE_DIR: runtimeCacheDir(session.candidateRoot, 'candidate') }, shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
  let startupError = ''; child.stderr?.on('data', chunk => { startupError = `${startupError}${String(chunk)}`.slice(-2000); });
  runtimes.set(session.id, child);
  const starting = { ...session, runtime: { port: CANDIDATE_PORT, origin: CANDIDATE_ORIGIN, status: 'starting' as const } };
  for (let attempt = 0; attempt < 100; attempt++) { if (await health(CANDIDATE_ORIGIN, CANDIDATE_PORT)) return { ...starting, runtime: { ...starting.runtime!, status: 'healthy' } }; if (child.exitCode !== null) break; await new Promise(resolveDelay => setTimeout(resolveDelay, 100)); }
  await stopCandidateRuntime(starting);
  return { ...starting, runtime: { ...starting.runtime!, status: 'failed', ...(startupError ? { error: startupError.trim() } : {}) } };
}
export async function stopCandidateRuntime(session: ReviewSession): Promise<ReviewSession> { const child = runtimes.get(session.id); if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise<void>(resolveStop => { const timer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); resolveStop(); }, 2000); child.once('exit', () => { clearTimeout(timer); resolveStop(); }); }); } runtimes.delete(session.id); return { ...session, runtime: session.runtime ? { ...session.runtime, status: 'stopped' } : undefined }; }
export async function disposeReviewSession(session: ReviewSession): Promise<void> { if (!inside(tmpdir(), resolve(session.candidateRoot))) throw new Error('INVALID_REVIEW_SESSION_ROOT'); await stopCandidateRuntime(session); await rm(session.candidateRoot, { recursive: true, force: true }); }
export const reviewSourceDirectory = (root: string) => dirname(validateReviewPath(root, REVIEW_SOURCE));

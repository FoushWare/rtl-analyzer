import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import type { FileHandle } from 'node:fs/promises';
import type { Finding } from './model.js';

export const SOURCE_SNIPPET_LIMITS = Object.freeze({ contextLines: 5, maxLines: 100, maxBytes: 16 * 1024, totalBytes: 2 * 1024 * 1024 });
export type SnippetUnavailableReason = 'INVALID_PATH' | 'SYMLINK' | 'NON_REGULAR_FILE' | 'MISSING_FILE' | 'UNSUPPORTED_NOFOLLOW' | 'READ_FAILURE' | 'IDENTITY_CHANGED' | 'INVALID_RANGE' | 'POSITION_MISMATCH' | 'SOURCE_CHANGED' | 'HIGHLIGHT_TOO_LARGE' | 'SNIPPET_TOO_LARGE' | 'TOTAL_LIMIT';
export interface SnippetLine { readonly number: number; readonly text: string; readonly highlighted: boolean }
export interface SourceWindow { readonly id: string; readonly path: string; readonly startLine: number; readonly endLine: number; readonly lines: readonly SnippetLine[]; readonly bytes: number }
export interface FindingSnippet { readonly findingId: string; readonly sourceId?: string; readonly available: boolean; readonly reason?: SnippetUnavailableReason; readonly startLine?: number; readonly endLine?: number }
export interface SourceSnippetResult { readonly sources: readonly SourceWindow[]; readonly findings: readonly FindingSnippet[]; readonly embeddedBytes: number; readonly sourceTextByPath?: Readonly<Record<string, string>> }
export interface SourceSnippetOptions { readonly contextLines?: number; readonly maxLines?: number; readonly maxBytes?: number; readonly totalBytes?: number }

const pathError = (path: string) => !path || isAbsolute(path) || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('//') || path.includes('\\') || /[\0\r\n]/.test(path) || path.split('/').some(part => part === '..');
const unavailable = (findingId: string, reason: SnippetUnavailableReason): FindingSnippet => ({ findingId, available: false, reason });

async function validatePath(root: string, path: string): Promise<{ absolute: string } | SnippetUnavailableReason> {
  if (pathError(path)) return 'INVALID_PATH';
  const rootAbsolute = resolve(root), normalized = normalize(path), absolute = resolve(rootAbsolute, normalized), rel = relative(rootAbsolute, absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || normalized !== path) return 'INVALID_PATH';
  try {
    const rootStat = await lstat(rootAbsolute); if (rootStat.isSymbolicLink()) return 'SYMLINK';
    const parts = normalized.split('/'); let current = rootAbsolute;
    for (const part of parts) { current = join(current, part); const stat = await lstat(current); if (stat.isSymbolicLink()) return 'SYMLINK'; }
    const stat = await lstat(absolute); if (!stat.isFile()) return 'NON_REGULAR_FILE';
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'MISSING_FILE'; return 'READ_FAILURE'; }
  return { absolute };
}

async function readVerified(path: string, absolute: string): Promise<{ text: string; size: number } | SnippetUnavailableReason> {
  if (!constants.O_NOFOLLOW) return 'UNSUPPORTED_NOFOLLOW';
  let handle: FileHandle | undefined;
  try {
    handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = await handle.stat(); if (!before.isFile()) return 'NON_REGULAR_FILE';
    const text = await handle.readFile({ encoding: 'utf8' });
    const after = await handle.stat();
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) return 'IDENTITY_CHANGED';
    return { text, size: after.size };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code; if (code === 'ENOENT') return 'MISSING_FILE'; if (code === 'ELOOP') return 'SYMLINK'; return 'READ_FAILURE';
  } finally { await handle?.close().catch(() => undefined); }
}

function lineTable(text: string): { text: string; start: number; end: number }[] {
  const lines: { text: string; start: number; end: number }[] = []; let start = 0;
  for (let i = 0; i <= text.length;) { const match = text.slice(i).match(/\r\n|\r|\n/); if (!match) { lines.push({ text: text.slice(start), start, end: text.length }); break; } const end = i + match.index!; lines.push({ text: text.slice(start, end), start, end }); i = end + match[0].length; start = i; }
  return lines.length ? lines : [{ text: '', start: 0, end: 0 }];
}
function lineAt(lines: readonly { start: number; end: number }[], offset: number): number { const index = lines.findIndex(line => offset >= line.start && offset <= line.end); return index < 0 ? -1 : index; }
function scannerPoint(text: string, offset: number): { offset: number; line: number; column: number } {
  const prefix = text.slice(0, offset), parts = prefix.split(/\r\n|\r|\n/);
  return { offset, line: parts.length, column: parts.at(-1)!.length + 1 };
}
function samePoint(actual: { offset: number; line: number; column: number }, expected: { offset: number; line: number; column: number }): boolean {
  return actual.offset === expected.offset && actual.line === expected.line && actual.column === expected.column;
}

function makeWindow(path: string, finding: Finding, text: string, options: Required<SourceSnippetOptions>): SourceWindow | SnippetUnavailableReason {
  const lines = lineTable(text), start = finding.range.start.offset, end = finding.range.end.offset;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end > text.length) return 'INVALID_RANGE';
  if (!samePoint(scannerPoint(text, start), finding.range.start) || !samePoint(scannerPoint(text, end), finding.range.end)) return 'POSITION_MISMATCH';
  if (text.slice(start, end) !== finding.original) return 'SOURCE_CHANGED';
  const first = lineAt(lines, start), last = lineAt(lines, Math.max(start, end - 1)); if (first < 0 || last < 0) return 'INVALID_RANGE';
  if (last - first + 1 > options.maxLines || Buffer.byteLength(text.slice(start, end), 'utf8') > options.maxBytes) return 'HIGHLIGHT_TOO_LARGE';
  let from = Math.max(0, first - options.contextLines), to = Math.min(lines.length - 1, last + options.contextLines);
  while (to - from + 1 > options.maxLines) { if (from < first) from++; else if (to > last) to--; else return 'SNIPPET_TOO_LARGE'; }
  let bytes = Buffer.byteLength(text.slice(lines[from].start, lines[to].end), 'utf8');
  while (bytes > options.maxBytes && (from < first || to > last)) { if (from < first) from++; else to--; bytes = Buffer.byteLength(text.slice(lines[from].start, lines[to].end), 'utf8'); }
  if (bytes > options.maxBytes) return 'SNIPPET_TOO_LARGE';
  const id = `${path}:${from + 1}-${to + 1}`;
  return { id, path, startLine: from + 1, endLine: to + 1, bytes, lines: lines.slice(from, to + 1).map((line, i) => ({ number: from + i + 1, text: line.text, highlighted: from + i >= first && from + i <= last })) };
}

/**
 * Reads only finding-bearing files. Range matching verifies anchors, not full snapshot identity.
 * O_NOFOLLOW protects the opened file, but the lstat/open sequence cannot eliminate an
 * attacker replacing an ancestor directory concurrently; the approved scan root and its
 * ancestors must therefore be trusted during generation. These are generation-time reads,
 * not authoritative live or full-file snapshots.
 */
export async function extractSourceSnippets(root: string, findings: readonly Finding[], options: SourceSnippetOptions = {}): Promise<SourceSnippetResult> {
  const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
  const limits = { ...SOURCE_SNIPPET_LIMITS, ...options }, ordered = findings.slice().sort((a, b) => compare(a.path, b.path) || a.range.start.offset - b.range.start.offset || compare(a.id, b.id));
  const files = new Map<string, { text?: string; result?: SnippetUnavailableReason; absolute?: string }>(), windows = new Map<string, SourceWindow>(), output: FindingSnippet[] = []; let embeddedBytes = 0;
  for (const finding of ordered) {
    let file = files.get(finding.path);
    if (!file) { const validated = await validatePath(root, finding.path); file = {}; files.set(finding.path, file); if (typeof validated === 'string') file.result = validated; else { file.absolute = validated.absolute; const read = await readVerified(finding.path, validated.absolute); if (typeof read === 'string') file.result = read; else file.text = read.text; } }
    if (file.text === undefined) { output.push(unavailable(finding.id, file.result ?? 'READ_FAILURE')); continue; }
    const window = makeWindow(finding.path, finding, file.text, limits);
    if (typeof window === 'string') { output.push(unavailable(finding.id, window)); continue; }
    if (embeddedBytes + (windows.has(window.id) ? 0 : window.bytes) > limits.totalBytes) { output.push(unavailable(finding.id, 'TOTAL_LIMIT')); continue; }
    const alreadyStored = windows.has(window.id); windows.set(window.id, window); if (!alreadyStored) embeddedBytes += window.bytes;
    output.push({ findingId: finding.id, sourceId: window.id, available: true, startLine: window.startLine, endLine: window.endLine });
  }
  const sourceTextByPath: Record<string, string> = {};
  for (const [path, file] of files) if (file.text !== undefined) sourceTextByPath[path] = file.text;
  const result = { sources: [...windows.values()].sort((a, b) => compare(a.id, b.id)), findings: output, embeddedBytes } as unknown as SourceSnippetResult & { sourceTextByPath: Record<string, string> };
  Object.defineProperty(result, 'sourceTextByPath', { value: sourceTextByPath, enumerable: false, writable: false });
  return result;
}

import { createHash } from 'node:crypto';

export interface TextEdit {
  readonly path: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: string;
  readonly replacement: string;
}

export interface ValidatedTextEdit extends TextEdit {
  readonly expectedSha256: string;
  readonly replacementSha256: string;
}

export interface CandidateText {
  readonly text: string;
  readonly edits: readonly ValidatedTextEdit[];
}

export class EditSetRejected extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

function compareEdits(a: TextEdit, b: TextEdit): number {
  return a.path.localeCompare(b.path, 'en') || a.startOffset - b.startOffset || a.endOffset - b.endOffset || a.replacement.localeCompare(b.replacement, 'en');
}

export function validateTextEdits(sourceByPath: ReadonlyMap<string, string>, edits: readonly TextEdit[]): readonly ValidatedTextEdit[] {
  const sorted = [...edits].sort(compareEdits);
  const result: ValidatedTextEdit[] = [];
  for (const edit of sorted) {
    const source = sourceByPath.get(edit.path);
    if (source === undefined) throw new EditSetRejected('SOURCE_NOT_FOUND');
    if (!Number.isInteger(edit.startOffset) || !Number.isInteger(edit.endOffset) || edit.startOffset < 0 || edit.endOffset < edit.startOffset || edit.endOffset > source.length) throw new EditSetRejected('INVALID_EDIT_RANGE');
    const actual = source.slice(edit.startOffset, edit.endOffset);
    if (actual !== edit.expectedText) throw new EditSetRejected('EDIT_SOURCE_MISMATCH');
    const previous = result.at(-1);
    if (previous?.path === edit.path && edit.startOffset < previous.endOffset) {
      throw new EditSetRejected(previous.startOffset === edit.startOffset && previous.endOffset === edit.endOffset && previous.replacement === edit.replacement ? 'DUPLICATE_EDIT' : 'OVERLAPPING_EDITS');
    }
    result.push({ ...edit, expectedSha256: sha256(actual), replacementSha256: sha256(edit.replacement) });
  }
  return result;
}

export function editSetDigest(edits: readonly ValidatedTextEdit[]): string {
  return sha256(JSON.stringify(edits.map(edit => ({ path: edit.path, startOffset: edit.startOffset, endOffset: edit.endOffset, expectedSha256: edit.expectedSha256, replacementSha256: edit.replacementSha256 }))));
}

export function applyTextEditsInMemory(sourceByPath: ReadonlyMap<string, string>, edits: readonly TextEdit[]): ReadonlyMap<string, string> {
  const validated = validateTextEdits(sourceByPath, edits);
  const result = new Map(sourceByPath);
  const byPath = new Map<string, ValidatedTextEdit[]>();
  for (const edit of validated) byPath.set(edit.path, [...(byPath.get(edit.path) ?? []), edit]);
  for (const [path, pathEdits] of byPath) {
    let text = sourceByPath.get(path)!;
    for (const edit of [...pathEdits].sort((a, b) => b.startOffset - a.startOffset || b.endOffset - a.endOffset)) text = text.slice(0, edit.startOffset) + edit.replacement + text.slice(edit.endOffset);
    result.set(path, text);
  }
  return result;
}

export function unifiedTextDiff(path: string, before: string, after: string): string {
  if (before === after) return `--- ${path} (Before)\n+++ ${path} (After)\n(no changes)`;
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const lines: string[] = [`--- ${path} (Before)`, `+++ ${path} (After)`];
  for (const line of beforeLines) if (!afterLines.includes(line)) lines.push(`- ${line}`);
  for (const line of afterLines) if (!beforeLines.includes(line)) lines.push(`+ ${line}`);
  return lines.join('\n');
}

export { sha256 };

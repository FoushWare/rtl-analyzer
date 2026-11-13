import { createHash } from 'node:crypto';
import postcss from 'postcss';
import scss from 'postcss-scss';
import ts from 'typescript';
import { applyTextEditsInMemory, editSetDigest, unifiedTextDiff, validateTextEdits } from './edit-set.js';
import { proposalId, type GenericReviewSet } from './generic-review.js';

export interface GenericValidationResult {
  readonly state: 'Passed' | 'Failed' | 'Inconclusive';
  readonly reviewSetId: string;
  readonly originalSources: ReadonlyMap<string, string>;
  readonly candidateSources: ReadonlyMap<string, string>;
  readonly sourceDigests: Readonly<Record<string, string>>;
  readonly candidateDigests: Readonly<Record<string, string>>;
  readonly diffs: readonly string[];
  readonly proposalIds: readonly string[];
  readonly syntaxChecks: readonly { path: string; state: 'Passed' | 'Failed' | 'Unsupported'; reason?: string }[];
  readonly limitations: readonly string[];
}

export class GenericValidationRejected extends Error { constructor(readonly code: string) { super(code); } }
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

function syntaxCheck(path: string, source: string): { path: string; state: 'Passed' | 'Failed' | 'Unsupported'; reason?: string } {
  try {
    if (/\.(?:css|module\.css)$/.test(path)) { postcss.parse(source, { from: undefined }); return { path, state: 'Passed' }; }
    if (/\.scss$/.test(path)) { scss.parse(source, { from: undefined }); return { path, state: 'Passed' }; }
    if (/\.(?:[cm]?[jt]sx?|jsx)$/.test(path)) { const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, /\.(?:tsx|jsx)$/.test(path) ? ts.ScriptKind.TSX : /\.js$/.test(path) ? ts.ScriptKind.JSX : ts.ScriptKind.TS) as ts.SourceFile & { parseDiagnostics?: readonly ts.Diagnostic[] }; return file.parseDiagnostics?.length ? { path, state: 'Failed', reason: 'TS_PARSE_FAILED' } : { path, state: 'Passed' }; }
    return { path, state: 'Unsupported', reason: 'SYNTAX_VALIDATION_UNSUPPORTED' };
  } catch { return { path, state: 'Failed', reason: 'SYNTAX_PARSE_FAILED' }; }
}

export function validateReviewSet(review: GenericReviewSet, sources: ReadonlyMap<string, string>): GenericValidationResult {
  if (review.schemaVersion !== 2) throw new GenericValidationRejected('UNSUPPORTED_SCHEMA_VERSION');
  const sourceDigests: Record<string, string> = {};
  for (const [path, expected] of Object.entries(review.sourceDigests)) { const source = sources.get(path); if (source === undefined) throw new GenericValidationRejected('SOURCE_NOT_FOUND'); sourceDigests[path] = sha(source); if (sourceDigests[path] !== expected) throw new GenericValidationRejected('STALE_SOURCE'); }
  for (const proposal of review.proposals) {
    if (proposalId(proposal) !== review.proposalIds[review.proposals.indexOf(proposal)]) throw new GenericValidationRejected('TAMPERED_PROPOSAL');
    const source = sources.get(proposal.sourcePath); if (source === undefined) throw new GenericValidationRejected('SOURCE_NOT_FOUND');
    const validated = validateTextEdits(new Map([[proposal.sourcePath, source]]), proposal.edits);
    if (editSetDigest(validated) !== proposal.editSetDigest) throw new GenericValidationRejected('EDIT_SET_DIGEST_MISMATCH');
  }
  const candidateSources = applyTextEditsInMemory(sources, review.proposals.flatMap(proposal => proposal.edits));
  const syntaxChecks = [...new Set(review.proposals.map(proposal => proposal.sourcePath))].map(path => syntaxCheck(path, candidateSources.get(path)!));
  const failed = syntaxChecks.some(check => check.state === 'Failed');
  const unsupported = syntaxChecks.some(check => check.state === 'Unsupported');
  const candidateDigests = Object.fromEntries([...candidateSources].filter(([path, source]) => sourceDigests[path] !== undefined && source !== sources.get(path)).map(([path, source]) => [path, sha(source)]));
  return { state: failed ? 'Failed' : unsupported ? 'Inconclusive' : 'Passed', reviewSetId: review.reviewSetId, originalSources: new Map(sources), candidateSources, sourceDigests, candidateDigests, diffs: [...new Set(review.proposals.map(proposal => proposal.sourcePath))].sort().map(path => unifiedTextDiff(path, sources.get(path)!, candidateSources.get(path)!)), proposalIds: [...review.proposalIds], syntaxChecks, limitations: ['Static validation does not establish semantic, runtime, or visual correctness.', 'Finding disappearance is not asserted without a generic scanner comparator.'] };
}

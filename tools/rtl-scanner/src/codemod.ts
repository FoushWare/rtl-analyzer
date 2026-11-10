import ts from 'typescript';
import { createHash } from 'node:crypto';
import type { Finding } from './model.js';
import { REVIEW_SOURCE, type PatchRequest, type ReviewSession } from './review-session.js';
import { applyReviewPatch } from './review-session.js';

export const BIDI_TRANSFORMATION_ID = 'bidi-isolate-auto';
export interface TransformationProposal { readonly transformationId: typeof BIDI_TRANSFORMATION_ID; readonly patch: PatchRequest; readonly reason: string }
export class TransformationRejected extends Error { constructor(readonly code: string) { super(code); } }
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

function hasIsolation(node: ts.Node): boolean {
  for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent)) {
      const opening = ts.isJsxElement(parent) ? parent.openingElement : parent;
      const tag = opening.tagName.getText();
      if (tag === 'bdi' || opening.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText() === 'dir')) return true;
    }
  }
  return false;
}

export function proposeBidiIsolation(finding: Finding, source: string): TransformationProposal {
  if (finding.id !== 'RTL.BIDI.ISOLATION:741d2ce2aec3a86cf2db37ea' || finding.path !== REVIEW_SOURCE) throw new TransformationRejected('UNSUPPORTED_FINDING_IDENTITY');
  const file = ts.createSourceFile(REVIEW_SOURCE, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let target: ts.JsxExpression | undefined;
  function visit(node: ts.Node): void { if (ts.isJsxExpression(node) && node.getStart(file) === finding.range.start.offset && node.end === finding.range.end.offset) target = node; ts.forEachChild(node, visit); }
  visit(file);
  if (!target) throw new TransformationRejected('UNSUPPORTED_AST_RANGE');
  if (!target.expression || !ts.isPropertyAccessExpression(target.expression) || target.expression.name.text !== 'id') throw new TransformationRejected('AMBIGUOUS_TOKEN_EXPRESSION');
  if (hasIsolation(target)) throw new TransformationRejected('ALREADY_ISOLATED');
  if (!target.parent || !(ts.isJsxElement(target.parent) || ts.isJsxFragment(target.parent))) throw new TransformationRejected('UNSUPPORTED_WRAPPER');
  const original = source.slice(finding.range.start.offset, finding.range.end.offset);
  if (original !== '{i.id}') throw new TransformationRejected('SOURCE_RANGE_MISMATCH');
  return { transformationId: BIDI_TRANSFORMATION_ID, reason: 'Direct invoice ID property access in JSX; wrap the exact expression in auto-direction bidi isolation.', patch: { findingId: finding.id, path: REVIEW_SOURCE, startOffset: finding.range.start.offset, endOffset: finding.range.end.offset, expectedSha256: sha(original), replacement: '<bdi dir="auto">{i.id}</bdi>' } };
}

export async function dryRunBidiIsolation(session: ReviewSession, finding: Finding, source: string): Promise<{ proposal: TransformationProposal; candidate: ReviewSession }> {
  const proposal = proposeBidiIsolation(finding, source);
  const candidate = await applyReviewPatch(session, proposal.patch);
  return { proposal, candidate };
}

export function analyzeBidiIsolation(finding: Finding, source: string): TransformationProposal {
  return proposeBidiIsolation(finding, source);
}

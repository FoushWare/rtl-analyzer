import type { Finding } from './model.js';
import { createFixProposal, FixProposalRejected, type FixProposal } from './fix-proposal.js';
import { type TextEdit } from './edit-set.js';
import postcss, { type Declaration, type Root } from 'postcss';
import scss from 'postcss-scss';

export const CSS_LOGICAL_TRANSFORMATION_ID = 'css-logical-property';
const mappings = new Map([['margin-left', 'margin-inline-start'], ['padding-right', 'padding-inline-end']]);

export interface CssProposalContext { readonly inputDigest: string; readonly policyDigest: string }
export type CssProposalEligibility = 'ASSISTED' | 'AUTOMATED_ELIGIBLE' | 'MANUAL';
export interface CssEligibilityDecision { readonly eligibility: CssProposalEligibility; readonly blockers: readonly string[]; readonly reason: string }

function parse(path: string, source: string): Root {
  try { return (path.endsWith('.scss') ? scss.parse(source, { from: undefined }) : postcss.parse(source, { from: undefined })) as Root; }
  catch { throw new FixProposalRejected('CSS_PARSE_FAILED'); }
}

function declarationFor(finding: Finding, source: string): { root: Root; declaration: Declaration } {
  const root = parse(finding.path, source);
  let declaration: Declaration | undefined;
  root.walkDecls(item => { if (item.source?.start?.offset === finding.range.start.offset || item.source?.start?.offset === finding.range.start.offset + item.prop.length + 1) declaration = item; });
  if (!declaration) throw new FixProposalRejected('DECLARATION_NOT_FOUND');
  return { root, declaration };
}

export function classifyCssEligibility(finding: Finding, source: string): CssEligibilityDecision {
  const blockers: string[] = [];
  if (!/\.(?:module\.)?(?:css|scss)$/.test(finding.path)) blockers.push('CSS_SOURCE_REQUIRED');
  if (finding.ruleId !== 'RTL.CSS.PHYSICAL' || finding.sourceMechanism !== 'css') blockers.push('UNSUPPORTED_CSS_RULE');
  if (/\.(?:scss)$/.test(finding.path) && /@(?:mixin|include|use|forward|import)\b|#\{/.test(source)) blockers.push('SOURCE_COVERAGE');
  let declaration: Declaration | undefined;
  if (!blockers.length) {
    try { declaration = declarationFor(finding, source).declaration; } catch (error) { blockers.push(error instanceof FixProposalRejected ? error.code : 'CSS_PARSE_FAILED'); }
  }
  if (declaration) {
    const siblings = declaration.parent?.nodes?.filter(node => node.type === 'decl') as Declaration[] | undefined ?? [];
    const physical = declaration.prop;
    const logical = mappings.get(physical);
    if (siblings.some(node => node !== declaration && node.prop === physical)) blockers.push('DUPLICATE_DECLARATION');
    if (logical && siblings.some(node => node !== declaration && node.prop === logical)) blockers.push('LOGICAL_OVERRIDE');
    const shorthand = physical.startsWith('margin-') ? 'margin' : physical.startsWith('padding-') ? 'padding' : null;
    if (shorthand && siblings.some(node => node !== declaration && node.prop === shorthand)) blockers.push('SHORTHAND_CONFLICT');
  }
  if (blockers.length) return { eligibility: 'MANUAL', blockers, reason: 'Static source contains ambiguity or incomplete coverage; no safe proposal is eligible.' };
  if (finding.category === 'AUTO_CANDIDATE' && finding.confidence === 'High') return { eligibility: 'AUTOMATED_ELIGIBLE', blockers: [], reason: 'The declaration is static, uniquely located, and policy-approved.' };
  return { eligibility: 'ASSISTED', blockers: ['SEMANTIC_INTENT_REQUIRES_REVIEW'], reason: 'A deterministic proposal is possible, but physical-to-logical intent is not proven by syntax alone.' };
}

export function proposeCssLogicalProperty(finding: Finding, source: string, context: CssProposalContext): FixProposal {
  if (!/\.(?:module\.)?(?:css|scss)$/.test(finding.path)) throw new FixProposalRejected('CSS_SOURCE_REQUIRED');
  if (finding.ruleId !== 'RTL.CSS.PHYSICAL') throw new FixProposalRejected('UNSUPPORTED_CSS_RULE');
  if (finding.sourceMechanism !== 'css') throw new FixProposalRejected('UNSUPPORTED_CSS_MECHANISM');
  const eligibility = classifyCssEligibility(finding, source);
  if (eligibility.eligibility === 'MANUAL') throw new FixProposalRejected(eligibility.blockers[0] ?? 'CSS_ELIGIBILITY_FAILED');
  const original = source.slice(finding.range.start.offset, finding.range.end.offset);
  if (original !== finding.original) throw new FixProposalRejected('FINDING_RANGE_MISMATCH');
  const match = /^(\s*)(margin-left|padding-right)(\s*:)/.exec(original);
  if (!match) throw new FixProposalRejected('UNSUPPORTED_CSS_DECLARATION');
  const property = mappings.get(match[2]);
  if (!property) throw new FixProposalRejected('UNSUPPORTED_CSS_DECLARATION');
  const edit: TextEdit = { path: finding.path, startOffset: finding.range.start.offset + match[1].length, endOffset: finding.range.start.offset + match[1].length + match[2].length, expectedText: match[2], replacement: property };
  return createFixProposal(finding, source, [edit], { ...context, transformationId: CSS_LOGICAL_TRANSFORMATION_ID });
}

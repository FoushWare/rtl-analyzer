import ts from 'typescript';
import postcss, { type Declaration } from 'postcss';
import type { Finding } from './model.js';
import { createFixProposal, FixProposalRejected, type FixProposal } from './fix-proposal.js';
import type { TextEdit } from './edit-set.js';

export const TYPESCRIPT_LOGICAL_TRANSFORMATION_ID = 'typescript-logical-property';
const mappings = new Map([['marginLeft', 'marginInlineStart'], ['marginRight', 'marginInlineEnd'], ['paddingLeft', 'paddingInlineStart'], ['paddingRight', 'paddingInlineEnd']]);
const cssMappings = new Map([['margin-left', 'margin-inline-start'], ['padding-right', 'padding-inline-end']]);

export interface TypeScriptProposalContext { readonly inputDigest: string; readonly policyDigest: string }
export type TypeScriptProposalEligibility = 'ASSISTED' | 'AUTOMATED_ELIGIBLE' | 'MANUAL';
export interface TypeScriptEligibilityDecision { readonly eligibility: TypeScriptProposalEligibility; readonly blockers: readonly string[]; readonly reason: string }

function sourceFile(path: string, source: string): ts.SourceFile {
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, /\.tsx?$/.test(path) || /\.jsx$/.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.JSX);
}

function importsOf(file: ts.SourceFile): Map<string, string> {
  const result = new Map<string, string>();
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (clause?.name) result.set(clause.name.text, node.moduleSpecifier.text);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) for (const item of clause.namedBindings.elements) result.set(item.name.text, `${node.moduleSpecifier.text}:${item.propertyName?.text ?? item.name.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return result;
}

function staticValue(node: ts.Expression): boolean {
  return ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand);
}

function propertyName(node: ts.PropertyName): string | null {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function directStyleObject(file: ts.SourceFile, property: ts.PropertyAssignment): boolean {
  let parent: ts.Node = property.parent;
  while (parent && !ts.isJsxAttribute(parent) && !ts.isCallExpression(parent)) parent = parent.parent;
  if (ts.isJsxAttribute(parent)) return parent.name.getText(file) === 'style' && !!parent.initializer && ts.isJsxExpression(parent.initializer) && parent.initializer.expression === property.parent;
  if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.getText(file) === 'React.createElement') {
    const props = parent.arguments[1];
    return !!props && ts.isObjectLiteralExpression(props) && props.properties.some(item => ts.isPropertyAssignment(item) && item.name.getText(file) === 'style' && item.initializer === property.parent);
  }
  return false;
}

function findInlineProperty(file: ts.SourceFile, finding: Finding): ts.PropertyAssignment {
  let result: ts.PropertyAssignment | undefined;
  function visit(node: ts.Node): void {
    if (ts.isPropertyAssignment(node) && node.getStart(file) === finding.range.start.offset && node.end === finding.range.end.offset) result = node;
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!result) throw new FixProposalRejected('INLINE_PROPERTY_RANGE_NOT_FOUND');
  return result;
}

function siblingBlocker(property: ts.PropertyAssignment, logical: string): string | null {
  const siblings = ts.isObjectLiteralExpression(property.parent) ? property.parent.properties : [];
  for (const sibling of siblings) {
    if (sibling === property) continue;
    if (!ts.isPropertyAssignment(sibling)) return 'COMPUTED_OR_UNRESOLVED_PROPERTY';
    const name = propertyName(sibling.name);
    if (!name) return 'COMPUTED_OR_UNRESOLVED_PROPERTY';
    if (name === logical) return 'LOGICAL_OVERRIDE';
    if (name === propertyName(property.name)) return 'DUPLICATE_DECLARATION';
    if (name === 'margin' && propertyName(property.name)?.startsWith('margin')) return 'SHORTHAND_CONFLICT';
    if (name === 'padding' && propertyName(property.name)?.startsWith('padding')) return 'SHORTHAND_CONFLICT';
  }
  return null;
}

function inlineEdit(finding: Finding, source: string): TextEdit {
  const file = sourceFile(finding.path, source);
  const property = findInlineProperty(file, finding);
  const name = propertyName(property.name);
  if (!name || !mappings.has(name)) throw new FixProposalRejected('UNSUPPORTED_INLINE_PROPERTY');
  if (!directStyleObject(file, property)) throw new FixProposalRejected('UNVERIFIED_STYLE_OWNER');
  if (!staticValue(property.initializer)) throw new FixProposalRejected('DYNAMIC_STYLE_VALUE');
  const blocker = siblingBlocker(property, mappings.get(name)!);
  if (blocker) throw new FixProposalRejected(blocker);
  const start = property.name.getStart(file);
  return { path: finding.path, startOffset: start, endOffset: property.name.end, expectedText: name, replacement: mappings.get(name)! };
}

function baseTag(tag: ts.Expression): ts.Expression {
  while (ts.isPropertyAccessExpression(tag) || ts.isCallExpression(tag) || ts.isParenthesizedExpression(tag)) tag = tag.expression;
  return tag;
}

function emotionTemplate(finding: Finding, source: string): { start: number; replacement: string } {
  const file = sourceFile(finding.path, source);
  const imports = importsOf(file);
  let answer: { start: number; replacement: string } | undefined;
  function visit(node: ts.Node): void {
    if (!ts.isTaggedTemplateExpression(node)) { ts.forEachChild(node, visit); return; }
    const tag = baseTag(node.tag);
    const imported = ts.isIdentifier(tag) ? imports.get(tag.text) : undefined;
    const cssProp = imported === '@emotion/react:css' && ts.isJsxExpression(node.parent) && ts.isJsxAttribute(node.parent.parent) && node.parent.parent.name.getText(file) === 'css';
    const styled = imported === '@emotion/styled';
    if (!cssProp && !styled) { ts.forEachChild(node, visit); return; }
    if (!ts.isNoSubstitutionTemplateLiteral(node.template)) throw new FixProposalRejected('EMOTION_INTERPOLATION');
    const templateStart = node.template.getStart(file) + 1;
    const raw = source.slice(templateStart, node.template.end - 1);
    let root;
    try { root = postcss.parse(raw, { from: undefined }); } catch { throw new FixProposalRejected('EMOTION_CSS_PARSE_FAILED'); }
    root.walkDecls((declaration: Declaration) => {
      const start = templateStart + (declaration.source?.start?.offset ?? 0);
      if (start === finding.range.start.offset && start + declaration.toString().length <= finding.range.end.offset + declaration.toString().length) {
        const property = declaration.prop;
        const replacement = cssMappings.get(property);
        if (!replacement) throw new FixProposalRejected('UNSUPPORTED_EMOTION_PROPERTY');
        const siblings = declaration.parent?.nodes?.filter(item => item.type === 'decl') as Declaration[] | undefined ?? [];
        if (siblings.some(item => item !== declaration && item.prop === replacement)) throw new FixProposalRejected('LOGICAL_OVERRIDE');
        if (siblings.some(item => item !== declaration && item.prop === property)) throw new FixProposalRejected('DUPLICATE_DECLARATION');
        if (siblings.some(item => item !== declaration && item.prop === (property.startsWith('margin-') ? 'margin' : 'padding'))) throw new FixProposalRejected('SHORTHAND_CONFLICT');
        answer = { start: start + property.length === finding.range.start.offset ? start : start, replacement };
      }
    });
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!answer) throw new FixProposalRejected('EMOTION_DECLARATION_RANGE_NOT_FOUND');
  const original = source.slice(finding.range.start.offset, finding.range.end.offset);
  const match = /^(\s*)(margin-left|padding-right)(\s*:)/.exec(original);
  if (!match) throw new FixProposalRejected('EMOTION_DECLARATION_RANGE_MISMATCH');
  return { start: finding.range.start.offset + match[1].length, replacement: answer.replacement };
}

export function classifyTypeScriptEligibility(finding: Finding, source: string): TypeScriptEligibilityDecision {
  try {
    const proposal = proposeTypeScriptLogicalProperty(finding, source, { inputDigest: 'eligibility', policyDigest: 'eligibility' });
    if (finding.category === 'AUTO_CANDIDATE' && finding.confidence === 'High') return { eligibility: 'AUTOMATED_ELIGIBLE', blockers: [], reason: `Verified static ${proposal.transformationId} syntax.` };
    return { eligibility: 'ASSISTED', blockers: ['SEMANTIC_INTENT_REQUIRES_REVIEW'], reason: 'The syntax is static, but physical-to-logical intent requires review.' };
  } catch (error) {
    return { eligibility: 'MANUAL', blockers: [error instanceof FixProposalRejected ? error.code : 'TRANSFORMATION_FAILED'], reason: 'The source is dynamic, ambiguous, or not owned by a verified supported integration.' };
  }
}

export function proposeTypeScriptLogicalProperty(finding: Finding, source: string, context: TypeScriptProposalContext): FixProposal {
  if (!/\.(?:[jt]sx?|jsx)$/.test(finding.path)) throw new FixProposalRejected('TYPESCRIPT_SOURCE_REQUIRED');
  if (finding.sourceMechanism === 'react-inline') return createFixProposal(finding, source, [inlineEdit(finding, source)], { ...context, transformationId: TYPESCRIPT_LOGICAL_TRANSFORMATION_ID });
  if (finding.sourceMechanism === 'emotion-template') {
    const edit = emotionTemplate(finding, source);
    const original = source.slice(finding.range.start.offset, finding.range.end.offset);
    const match = /^(\s*)(margin-left|padding-right)(\s*:)/.exec(original);
    if (!match) throw new FixProposalRejected('EMOTION_DECLARATION_RANGE_MISMATCH');
    return createFixProposal(finding, source, [{ path: finding.path, startOffset: edit.start, endOffset: edit.start + match[2].length, expectedText: match[2], replacement: edit.replacement }], { ...context, transformationId: TYPESCRIPT_LOGICAL_TRANSFORMATION_ID });
  }
  throw new FixProposalRejected('UNSUPPORTED_TYPESCRIPT_MECHANISM');
}

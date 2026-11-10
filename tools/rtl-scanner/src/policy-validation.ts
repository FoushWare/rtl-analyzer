import ts from 'typescript';
import { range, type Diagnostic, type Range } from './model.js';
import type { Policy } from './policy.js';

export const policyPath = 'rtl-scanner.config.json';
export const mechanisms = ['css', 'emotion-template', 'mui-sx', 'mui-theme', 'react-inline', 'html-root'] as const;
const owners = ['custom-css', 'custom-inline', 'custom-emotion-review', 'custom-emotion-logical', 'mui-generated', 'document-runtime', 'unknown'];
export const ruleIds = new Set([
  'RTL.CSS.PHYSICAL', 'RTL.CSS.SHORTHAND', 'RTL.GEOMETRY.EDGE', 'RTL.GEOMETRY.COUPLED', 'RTL.GEOMETRY.ORDER',
  'RTL.OWNERSHIP.CONFLICT', 'RTL.RUNTIME.MISMATCH', 'RTL.RUNTIME.CACHE', 'RTL.RUNTIME.CACHE_UNVERIFIED',
  'RTL.RUNTIME.DIRECTION_UNKNOWN', 'RTL.RUNTIME.PAGINATION', 'RTL.RUNTIME.LOCALE', 'RTL.FORM.DIRECTION',
  'RTL.TABLE.ALIGNMENT', 'RTL.CHART.LABEL_FLOW', 'RTL.ICON.PROGRESSION', 'RTL.ICON.LITERAL',
  'RTL.BIDI.ISOLATION', 'RTL.BRAND.ISLAND', 'RTL.DOCUMENT.INITIAL', 'RTL.DOCUMENT.RUNTIME',
]);
export const findingIdPattern = /^RTL\.[A-Z_]+(?:\.[A-Z_]+)*:[a-f0-9]{24}$/;
export class PolicyError extends Error {
  constructor(public diagnostic: Diagnostic) {
    super(`Invalid scanner policy: ${diagnostic.path}:${diagnostic.range.start.line}:${diagnostic.range.start.column} ${diagnostic.code}: ${diagnostic.message}`);
  }
}
const pointerPart = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
export function policyLocations(text: string): Map<string, Range> {
  const sf = ts.parseJsonText(policyPath, text);
  const locations = new Map<string, Range>();
  function walk(n: ts.Node, pointer: string) {
    locations.set(pointer, range(text, n.getStart(sf), n.end));
    if (ts.isObjectLiteralExpression(n)) {
      const seen = new Set<string>();
      for (const p of n.properties) if (ts.isPropertyAssignment(p) && ts.isStringLiteral(p.name)) {
        const child = `${pointer}/${pointerPart(p.name.text)}`;
        if (seen.has(p.name.text)) throw new PolicyError({ path: policyPath, range: range(text, p.getStart(sf), p.end), code: 'POLICY_DUPLICATE', message: `BLOCKING ${child}: duplicate JSON member`, blocking: true, impact: 'SOURCE_FAILURE', rationale: 'JSON member overwrite is ambiguous; no policy decisions are applied.' });
        seen.add(p.name.text); walk(p.initializer, child);
      }
    } else if (ts.isArrayLiteralExpression(n)) n.elements.forEach((e, i) => walk(e, `${pointer}/${i}`));
  }
  const statement = sf.statements[0];
  if (statement && ts.isExpressionStatement(statement)) walk(statement.expression, '');
  return locations;
}
export function validatePolicy(input: unknown, text: string): Policy {
  const locations = policyLocations(text);
  const fail = (pointer: string, message: string, code = 'POLICY_INVALID'): never => {
    const parent = pointer.slice(0, pointer.lastIndexOf('/'));
    throw new PolicyError({ path: policyPath, range: locations.get(pointer) ?? locations.get(parent) ?? range(text, 0, 0), code, message: `BLOCKING ${pointer || '/'}: ${message}`, blocking: true, impact: 'SOURCE_FAILURE', rationale: 'Policy input is invalid, conflicting or unsupported; no policy decisions are applied.' });
  };
  function object(value: unknown, pointer: string, required: string[], optional: string[] = []): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(pointer, 'expected object');
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj).sort()) if (![...required, ...optional].includes(key)) fail(`${pointer}/${pointerPart(key)}`, 'unknown field');
    for (const key of required) if (!Object.hasOwn(obj, key)) fail(`${pointer}/${key}`, 'required field missing');
    return obj;
  }
  const str = (v: unknown, p: string) => { if (typeof v !== 'string' || !v.trim() || v.length > 4096 || v.includes('\0')) fail(p, 'expected nonempty bounded string'); return v as string; };
  const enumValue = (v: unknown, p: string, values: readonly string[]) => { const s = str(v, p); if (!values.includes(s)) fail(p, 'unsupported enum value'); return s; };
  const pathValue = (v: unknown, p: string) => {
    const s = str(v, p);
    if (/^[\/\\]|^[A-Za-z]:|\\|[\r\n]/.test(s) || s.split('/').some(x => !x || x === '.' || x === '..')) fail(p, 'expected normalized repository-relative POSIX path');
  };
  const digest = (v: unknown, p: string) => { if (!/^[a-f0-9]{64}$/.test(str(v, p))) fail(p, 'expected lowercase SHA-256 digest'); };
  const rule = (v: unknown, p: string) => { if (!ruleIds.has(str(v, p))) fail(p, 'rule is not supported by this scanner', 'POLICY_UNSUPPORTED'); };
  const top = object(input, '', ['schemaVersion', 'generatedStyleOwner', 'ownership', 'approvals', 'exceptions', 'issueBindings', 'dynamicExceptions', 'roles'], ['ownerOverrides']);
  if (top.schemaVersion !== 1) fail('/schemaVersion', 'only schemaVersion 1 is supported', 'POLICY_UNSUPPORTED');
  enumValue(top.generatedStyleOwner, '/generatedStyleOwner', ['mui-generated', 'unknown']);
  const ownership = object(top.ownership, '/ownership', [], [...mechanisms]);
  for (const [k, v] of Object.entries(ownership)) {
    enumValue(v, `/ownership/${k}`, owners);
    const allowed = k === 'css' ? ['custom-css', 'unknown'] : k === 'react-inline' ? ['custom-inline', 'unknown'] : k === 'html-root' ? ['document-runtime', 'unknown'] : ['custom-emotion-review', 'custom-emotion-logical', 'unknown'];
    enumValue(v, `/ownership/${k}`, allowed);
  }
  const shapes: Record<string, [string[], string[]]> = {
    approvals: [['path', 'context', 'property', 'value', 'owner', 'logicalProperty', 'reason', 'reviewedBy', 'sourceDigest'], []],
    exceptions: [['ruleId', 'path', 'context', 'category', 'reason', 'reviewedBy', 'originalDigest'], []],
    issueBindings: [['ruleId', 'path', 'contextIncludes', 'issueId'], ['originalIncludes']],
    dynamicExceptions: [['path', 'property', 'valueDigest', 'sourceDigest', 'reason'], []],
    roles: [['kind', 'path', 'className'], []],
    ownerOverrides: [['path', 'context', 'owner', 'reason'], []],
  };
  const identities: Record<string, string[]> = {
    approvals: ['path', 'context', 'property', 'value'], exceptions: ['ruleId', 'path', 'context', 'originalDigest'],
    issueBindings: ['ruleId', 'path', 'contextIncludes', 'originalIncludes', 'issueId'],
    dynamicExceptions: ['path', 'property', 'valueDigest'], roles: ['kind', 'path', 'className'], ownerOverrides: ['path', 'context'],
  };
  for (const [name, [required, optional]] of Object.entries(shapes)) {
    if (name === 'ownerOverrides' && !Object.hasOwn(top, name)) continue;
    const records = top[name];
    if (!Array.isArray(records) || records.length > 10000) fail(`/${name}`, 'expected bounded array');
    const seen = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < (records as unknown[]).length; i++) {
      const p = `/${name}/${i}`, entry = object((records as unknown[])[i], p, required, optional);
      for (const [key, v] of Object.entries(entry)) str(v, `${p}/${key}`);
      pathValue(entry.path, `${p}/path`);
      for (const key of ['sourceDigest', 'originalDigest', 'valueDigest']) if (key in entry) digest(entry[key], `${p}/${key}`);
      if ('ruleId' in entry) rule(entry.ruleId, `${p}/ruleId`);
      if ('owner' in entry) enumValue(entry.owner, `${p}/owner`, owners);
      if ('category' in entry) enumValue(entry.category, `${p}/category`, ['INTENTIONAL_LTR', 'INFORMATIONAL']);
      if (name === 'roles') enumValue(entry.kind, `${p}/kind`, ['brand']);
      if (name === 'dynamicExceptions') enumValue(entry.property, `${p}/property`, ['background']);
      if (name === 'issueBindings' && !/^RTL-0[1-9]$/.test(entry.issueId as string)) fail(`${p}/issueId`, 'unsupported reference issue ID');
      const identity = JSON.stringify(identities[name].map(k => entry[k] ?? null));
      const prior = seen.get(identity);
      if (prior) {
        const conflict = name === 'ownerOverrides' && prior.owner !== entry.owner || name === 'exceptions' && prior.category !== entry.category || name === 'approvals' && (prior.owner !== entry.owner || prior.logicalProperty !== entry.logicalProperty) || name === 'dynamicExceptions' && prior.sourceDigest !== entry.sourceDigest;
        fail(p, conflict ? 'conflicting policy records' : 'duplicate policy record', conflict ? 'POLICY_CONFLICT' : 'POLICY_DUPLICATE');
      }
      seen.set(identity, entry);
    }
  }
  return input as Policy;
}

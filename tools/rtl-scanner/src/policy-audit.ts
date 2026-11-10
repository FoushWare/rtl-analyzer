import { hash, range, type Diagnostic, type Evidence, type Finding } from './model.js';
import type { Policy } from './policy.js';
import { detect } from './rules.js';
import { findingIdPattern, policyLocations, policyPath, ruleIds } from './policy-validation.js';

/** Audit policy against the unexcepted source catalog, never against a suppressed result. */
export function auditPolicy(policy: Policy, text: string, evidence: Evidence[], sources: Map<string, string>, findings: Finding[], coverage: Diagnostic[]): Diagnostic[] {
  const locations = policyLocations(text), diagnostics: Diagnostic[] = [];
  function diagnostic(pointer: string, code: string, message: string, blocking: boolean) {
    diagnostics.push({ path: policyPath, range: locations.get(pointer) ?? range(text, 0, 0), code,
      message: `${blocking ? 'BLOCKING' : 'WARNING'} ${pointer}: ${message}`, blocking,
      ...(blocking ? { impact: 'DIRECTIONAL_UNSUPPORTED' as const } : {}),
      rationale: blocking ? 'This record cannot authorize a safe policy decision; analysis is incomplete.' : 'Informational association is unmatched; it cannot establish calibrated coverage.' });
  }
  const contextExists = (path: string, context: string) => evidence.some(e => e.path === path && e.context === context) || findings.some(f => f.path === path && f.context === context);
  function unsupported(path: string, pointer: string, blocking: boolean): boolean {
    if (coverage.some(d => d.path === path && d.blocking && d.code !== 'DYNAMIC_VALUE')) {
      diagnostic(pointer, 'POLICY_UNSUPPORTED', 'source coverage is incomplete; record applicability cannot be established', blocking); return true;
    }
    return false;
  }
  const key = (property: string) => property.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  policy.approvals.forEach((a, i) => {
    const p = `/approvals/${i}`;
    if (unsupported(a.path, p, true)) return;
    const matches = evidence.filter(e => e.path === a.path && e.context === a.context && e.property === a.property && e.value === a.value);
    if (matches.length !== 1 || !sources.has(a.path) || a.sourceDigest !== hash(sources.get(a.path)!)) {
      diagnostic(p, 'POLICY_STALE_APPROVAL', 'exact declaration/value or whole-file source pin no longer matches uniquely', true); return;
    }
    const e = matches[0], override = policy.ownerOverrides?.find(o => o.path === e.path && o.context === e.context);
    const owner = override?.owner ?? policy.ownership[e.mechanism] ?? 'unknown';
    const expected = key(a.property).replace(/^(margin|padding|border)-(left|right)(.*)$/, (_, group, side, suffix) => `${group}-inline-${side === 'left' ? 'start' : 'end'}${suffix}`);
    if (a.owner !== owner || !['custom-css', 'custom-inline', 'custom-emotion-logical'].includes(owner)) {
      diagnostic(p, 'POLICY_CONFLICT', 'approval owner does not establish the declared source pipeline', true); return;
    }
    if (key(a.logicalProperty) !== expected || !/^(margin|padding|border)-(left|right)(-|$)/.test(key(a.property)) || e.mechanism === 'mui-sx') {
      diagnostic(p, 'POLICY_UNSUPPORTED_APPROVAL', 'logical equivalent or source mechanism is not a bounded supported candidate', true); return;
    }
    if (policy.exceptions.some(x => x.ruleId === 'RTL.CSS.PHYSICAL' && x.path === e.path && x.context === e.context && x.originalDigest === hash(e.original))) {
      diagnostic(p, 'POLICY_CONFLICT', 'the same declaration has both a semantic approval and an exception', true); return;
    }
    // Reuse, rather than weaken or duplicate, the existing conservative candidate contract.
    const admitted = detect(evidence, sources, {...policy, approvals:[a], exceptions:[]}, coverage.map(d=>({...d})))
      .some(f => f.category === 'AUTO_CANDIDATE' && f.evidenceIds.includes(e.id));
    if (!admitted) diagnostic(p, 'POLICY_UNSUPPORTED_APPROVAL', 'existing conservative admission safeguards do not support this declaration', true);
  });
  policy.exceptions.forEach((x, i) => {
    const p = `/exceptions/${i}`, blocking = x.category !== 'INFORMATIONAL' || !['RTL.DOCUMENT.INITIAL', 'RTL.DOCUMENT.RUNTIME'].includes(x.ruleId);
    if (unsupported(x.path, p, blocking)) return;
    const matches = findings.filter(f => f.ruleId === x.ruleId && f.path === x.path && f.context === x.context && hash(f.original) === x.originalDigest);
    if (matches.length !== 1) diagnostic(p, blocking ? 'POLICY_STALE_EXCEPTION' : 'POLICY_STALE_INFORMATIONAL', 'exact finding anchor/declaration no longer matches uniquely', blocking);
  });
  policy.dynamicExceptions.forEach((x, i) => {
    const p = `/dynamicExceptions/${i}`;
    if (unsupported(x.path, p, true)) return;
    const matches = evidence.filter(e => e.path === x.path && e.property === x.property && hash(e.value) === x.valueDigest);
    if (!matches.length || !sources.has(x.path) || hash(sources.get(x.path)!) !== x.sourceDigest) {
      diagnostic(p, 'POLICY_STALE_DYNAMIC_EXCEPTION', 'expression or whole-file source pin no longer matches', true); return;
    }
    if (!matches.some(e => coverage.some(d => d.path === e.path && d.code === 'DYNAMIC_VALUE' && d.range.start.offset >= e.range.start.offset && d.range.end.offset <= e.range.end.offset))) {
      diagnostic(p, 'POLICY_STALE_DYNAMIC_EXCEPTION', 'record does not match an extracted dynamic-value diagnostic', true);
    }
  });
  policy.ownerOverrides?.forEach((x, i) => {
    const p = `/ownerOverrides/${i}`;
    if (unsupported(x.path, p, true)) return;
    if (!contextExists(x.path, x.context)) diagnostic(p, 'POLICY_STALE_OVERRIDE', 'source ownership context no longer exists', true);
    else {
      const mechanisms = evidence.filter(e => e.path === x.path && e.context === x.context).map(e => e.mechanism);
      const compatible = (m: typeof mechanisms[number]) => x.owner === 'unknown' || (m === 'css' ? x.owner === 'custom-css' : m === 'react-inline' ? x.owner === 'custom-inline' : m === 'html-root' ? x.owner === 'document-runtime' : ['custom-emotion-review', 'custom-emotion-logical'].includes(x.owner));
      if (!mechanisms.length || !mechanisms.every(compatible)) diagnostic(p, 'POLICY_CONFLICT', 'override does not establish a compatible extracted style mechanism', true);
    }
  });
  policy.issueBindings.forEach((b, i) => {
    const p = `/issueBindings/${i}`;
    if (unsupported(b.path, p, false)) return;
    if (!findings.some(f => f.ruleId === b.ruleId && f.path === b.path && f.context.includes(b.contextIncludes) && (!b.originalIncludes || f.original.includes(b.originalIncludes)))) diagnostic(p, 'POLICY_STALE_INFORMATIONAL', 'reference binding has no supported source finding; no issue coverage can be inferred', false);
  });
  policy.roles.forEach((role, i) => {
    // A role must yield the existing role rule, not merely name a source file containing that string.
    const p = `/roles/${i}`;
    if (unsupported(role.path, p, false)) return;
    if (!findings.some(f => f.ruleId === 'RTL.BRAND.ISLAND' && f.path === role.path && (f.original.match(/className\s*=\s*(['"])(.*?)\1/)?.[2].split(/\s+/).includes(role.className) ?? false))) diagnostic(p, 'POLICY_STALE_INFORMATIONAL', 'brand association has no matched source rule; review role applicability', false);
  });
  const ids = new Set<string>();
  for (const f of findings) {
    if (!findingIdPattern.test(f.id) || !f.id.startsWith(f.ruleId + ':') || !ruleIds.has(f.ruleId) || ids.has(f.id)) {
      diagnostics.push({ path: f.path, range: f.range, code: 'POLICY_FINDING_ID_INVALID', message: 'BLOCKING: invalid, unsupported or duplicate generated finding identity', impact: 'SOURCE_FAILURE', blocking: true, rationale: 'Policy decisions cannot rely on ambiguous finding identities.' });
    }
    ids.add(f.id);
  }
  return diagnostics;
}

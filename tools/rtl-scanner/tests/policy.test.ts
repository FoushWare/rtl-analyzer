import { it, expect } from 'vitest';
import { readFile, mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { emptyPolicy, loadPolicy, type Policy } from '../src/policy.js';
import { PolicyError, validatePolicy } from '../src/policy-validation.js';
import { auditPolicy } from '../src/policy-audit.js';
import { extractCss } from '../src/css.js';
import { extractTypescript } from '../src/typescript.js';
import { detect } from '../src/rules.js';
import { classifyDiagnostics, exitCode } from '../src/coverage.js';
import { hash, type Finding, type Report } from '../src/model.js';
import { scan } from '../src/scan.js';
import { json, markdown } from '../src/report.js';
const base = (): Policy => structuredClone({ ...emptyPolicy, generatedStyleOwner: 'mui-generated', ownership: { css: 'custom-css', 'react-inline': 'custom-inline', 'html-root': 'document-runtime' } });
const valid = (p: unknown) => validatePolicy(p, JSON.stringify(p, null, 2));
function failure(p: unknown): PolicyError {
  try { valid(p); } catch (e) { expect(e).toBeInstanceOf(PolicyError); return e as PolicyError; }
  throw new Error('Expected policy rejection');
}
const approval = (s = '.x{margin-left:2px}') => ({path: 'apps/x/src/a.css', context: 'stylesheet/.x', property: 'margin-left', value: '2px', owner: 'custom-css', logicalProperty: 'margin-inline-start', reason: 'Fixture reading-start relationship', reviewedBy: 'fixture only', sourceDigest: hash(s)});
function auditCss(p: Policy, s = '.x{margin-left:2px}', path = 'apps/x/src/a.css') {
  valid(p); const e = extractCss(path, s), sources = new Map([[path, s]]);
  const coverage = classifyDiagnostics(e.diagnostics, e.evidence, sources, p);
  const f = detect(e.evidence, sources, { ...p, approvals: [], exceptions: [], ownerOverrides: [] }, coverage.map(d => ({...d})));
  return auditPolicy(p, JSON.stringify(p, null, 2), e.evidence, sources, f, coverage);
}
async function temporary(p: Policy, callback: (root: string) => Promise<void>, source = '.x{margin-left:2px}') {
  const root = await mkdtemp(join(tmpdir(), 'atlas-policy-4b-'));
  try {
    await mkdir(join(root, 'apps/x/src'), {recursive: true}); await mkdir(join(root, 'libs'));
    await writeFile(join(root, 'apps/x/project.json'), '{"sourceRoot":"apps/x/src"}');
    await writeFile(join(root, 'apps/x/index.html'), '<html dir="ltr"></html>');
    await writeFile(join(root, 'apps/x/src/a.css'), source);
    await writeFile(join(root, 'rtl-scanner.config.json'), JSON.stringify(p, null, 2));
    await callback(root);
  } finally { await rm(root, {recursive: true, force: true}); }
}
// Immutable artifact hashes verified during repair against approved Stage 3 commit
// 0de6d609cbfb9aae662d1cb7c9589c38592bb21b. Normal tests require no Git/network.
const historicalHashes = {
  json: 'ba990cf34f1a3e44317549829ef90793a6dabafada36feeb5d19460e7dbd9737',
  markdown: 'e22879500f08c9f73179a778dde7e68ab8b44b1f718cf75afb0e69163d52c2ac',
};
const pilot = [
  {context:'stylesheet/.status-dot', value:'6px', id:'RTL.CSS.PHYSICAL:5c1ae10d9ddc0c6daf3c5945'},
  {context:'stylesheet/.chart-legend i', value:'7px', id:'RTL.CSS.PHYSICAL:911c43329429945ea8519fad'},
];
async function historicalReport(): Promise<Report> {
  const text = await readFile('docs/phase-3-rtl-findings.json', 'utf8');
  expect(hash(text)).toBe(historicalHashes.json);
  return JSON.parse(text) as Report;
}
// Source offsets can move after an approved spelling change. Preserve every
// nonlocation field; validate live ranges separately against actual source.
function findingMeaning(f: Finding) {
  const {range: location, relatedLocations, ...meaning} = f;
  expect(location.start.offset).toBeLessThanOrEqual(location.end.offset);
  return {...meaning, relatedLocations:relatedLocations.map(l=>({path:l.path}))};
}
it('historical Stage 3 reports retain independently pinned content and formatting', async () => {
  const report = await historicalReport();
  const md = await readFile('docs/phase-3-rtl-findings.md', 'utf8');
  expect(hash(md)).toBe(historicalHashes.markdown);
  expect(report.schemaVersion).toBe(2); expect(report.kind).toBe('rtl-risk-report');
  expect(report.complete).toBe(true); expect(report.evidence).toHaveLength(419);
  expect(report.findings).toHaveLength(58); expect(report.diagnostics).toHaveLength(9);
  expect(report.metrics.byCategory).toEqual({MANUAL_REVIEW:50,RUNTIME_CONFIG:5,INTENTIONAL_LTR:2,INFORMATIONAL:1});
  expect(report.findings.filter(f=>!['INTENTIONAL_LTR','INFORMATIONAL'].includes(f.category))).toHaveLength(55);
  expect(new Set(report.findings.map(f=>f.id)).size).toBe(report.findings.length);
  for (const candidate of pilot) expect(report.findings.find(f=>f.id===candidate.id)).toMatchObject({category:'MANUAL_REVIEW', context:candidate.context, original:`margin-right: ${candidate.value};`});
  expect(json(report)).toBe(await readFile('docs/phase-3-rtl-findings.json','utf8'));
  expect(markdown(report)).toBe(md);
});
it('live Atlas scan reflects approved logical margins and theme relocation while preserving all five exceptions', async () => {
  const p = await loadPolicy(process.cwd()), historical = await historicalReport();
  expect(p.dynamicExceptions).toHaveLength(3); expect(p.exceptions).toHaveLength(2); expect(p.approvals).toEqual([]);
  expect(p.ownership.css).toBe('custom-css');
  expect(p.issueBindings).not.toContainEqual({ruleId:'RTL.GEOMETRY.EDGE',path:'libs/design-system/src/styles.css',contextIncludes:'.kpi-icon',issueId:'RTL-03'});
  const report = await scan(process.cwd()), repeated = await scan(process.cwd());
  expect(report.complete).toBe(true);
  const runtimePath='libs/design-system/src/runtime.tsx';
  const oldTheme=historical.evidence.filter(e=>e.path==='libs/design-system/src/index.tsx'&&e.mechanism==='mui-theme'&&e.context.startsWith('theme/'));
  expect(oldTheme).toHaveLength(8);
  const factMeaning=(e: Report['evidence'][number])=>{const {id,range,...meaning}=e;expect(id).toBeTruthy();expect(range.start.offset).toBeLessThanOrEqual(range.end.offset);return meaning;};
  const expectedFacts=historical.evidence.map(factMeaning).map(e=>{
    if(e.path==='libs/design-system/src/styles.css'&&e.context==='stylesheet/.kpi-icon'&&e.property==='right')return {...e,property:'inset-inline-end',original:'inset-inline-end: 20px;'};
    if(e.path==='libs/design-system/src/index.tsx'&&e.mechanism==='mui-theme'&&e.context.startsWith('theme/'))return {...e,path:runtimePath};
    if(e.path==='libs/design-system/src/styles.css'&&pilot.some(c=>c.context===e.context)&&e.property==='margin-right')return {...e,property:'margin-inline-end',original:`margin-inline-end: ${e.value};`};
    const shell=e.path==='libs/design-system/src/index.tsx'&&e.context==='SidebarFrame/';
    const gutter=e.path==='libs/design-system/src/styles.css'&&e.context.endsWith('/.app-main');
    const active=e.path==='libs/design-system/src/styles.css'&&e.context==='stylesheet/nav a.active';
    const logical=shell?({left:'inset-inline-start','border-right':'border-inline-end'} as Record<string,string>)[e.property]:gutter&&e.property==='margin-left'?'margin-inline-start':active?({'border-left':'border-inline-start','padding-left':'padding-inline-start'} as Record<string,string>)[e.property]:undefined;
    if(logical)return {...e,property:logical,original:e.original.replace(e.property+':',logical+':')};
    return e;
  });
  const preparedFacts=oldTheme.map(factMeaning).map(e=>({...e,path:runtimePath,context:e.context.replace('theme/','rtlTheme/')}));
  const negativeFact=historical.evidence.find(e=>e.path==='libs/design-system/src/index.tsx'&&e.context==='SidebarFrame/@media (max-width: 900px)'&&e.property==='transform'&&e.value==='translateX(-100%)')!;
  expect(negativeFact).toBeTruthy();
  const positiveFact={...factMeaning(negativeFact),context:'SidebarFrame/@media (max-width: 900px)/html[dir="rtl"] &:not(.is-open)',value:'translateX(100%)',original:'transform: translateX(100%);',tokens:['translateX(100%)']};
  const chartFacts=[{"path": "libs/design-system/src/styles.css", "mechanism": "css", "context": "stylesheet/.chart-wrap", "property": "direction", "value": "ltr", "original": "direction: ltr;", "semantics": "css", "tokens": ["ltr"]}, {"path": "libs/design-system/src/styles.css", "mechanism": "css", "context": "stylesheet/html[dir=\"rtl\"] .chart-labels span", "property": "direction", "value": "rtl", "original": "direction: rtl;", "semantics": "css", "tokens": ["rtl"]}, {"path": "libs/design-system/src/styles.css", "mechanism": "css", "context": "stylesheet/html[dir=\"rtl\"] .chart-labels span", "property": "unicode-bidi", "value": "isolate", "original": "unicode-bidi: isolate;", "semantics": "css", "tokens": ["isolate"]}];
  const ordered=<T,>(items:T[])=>items.map(e=>JSON.stringify(e)).sort();
  const brandFact={path:'libs/design-system/src/styles.css',mechanism:'css',context:'stylesheet/.brand',property:'direction',value:'ltr',original:'direction: ltr;',semantics:'css',tokens:['ltr']};
  const arrowBackFacts: Report['evidence']=[{"id":"32869cf5037c74759f509f79dfeb84bfffe2289a939313afeb0cf4541aa3e221","path":"apps/invoicing/src/components/InvoiceTable.tsx","mechanism":"mui-sx","context":"InvoiceTable/ArrowBack","property":"fontSize","value":"15","original":"fontSize: 15","range":{"start":{"offset":2472,"line":78,"column":34},"end":{"offset":2484,"line":78,"column":46}},"semantics":"mui-system"},{"id":"f05e60a9be9bc2433fb95fc3c40c60a082d02143d4d6f1fa7d7e5f7a9fd7d57e","path":"apps/invoicing/src/components/InvoiceTable.tsx","mechanism":"mui-sx","context":"InvoiceTable/ArrowBack","property":"color","value":"\"#9aa2b3\"","original":"color: \"#9aa2b3\"","range":{"start":{"offset":2486,"line":78,"column":48},"end":{"offset":2502,"line":78,"column":64}},"semantics":"mui-system"}];
  expect(report.evidence.filter(e=>e.path==='apps/invoicing/src/components/InvoiceTable.tsx'&&e.context==='InvoiceTable/ArrowBack')).toEqual(arrowBackFacts);
  const sidebarArrowFact: Report['evidence'][number]={"id":"ac7e998160b4c8f482d48521712d68062325e5b7cb138b7a0c39d326f2dafe8a","path":"libs/design-system/src/styles.css","mechanism":"css","context":"stylesheet/html[dir=\"rtl\"] .app-link > svg:last-child","property":"transform","value":"scaleX(-1)","original":"transform: scaleX(-1);","range":{"start":{"offset":1231,"line":81,"column":3},"end":{"offset":1253,"line":81,"column":25}},"semantics":"css","tokens":["scaleX(-1)"]};
  expect(report.evidence.find(e=>e.id===sidebarArrowFact.id)).toEqual(sidebarArrowFact);
  expect(ordered(report.evidence.map(factMeaning))).toEqual(ordered([...expectedFacts,...preparedFacts,positiveFact,...chartFacts,brandFact,...arrowBackFacts.map(factMeaning),factMeaning(sidebarArrowFact)]));
  expect(report.evidence).toHaveLength(historical.evidence.length+preparedFacts.length+1+chartFacts.length+1+arrowBackFacts.length+1);
  const diagnosticMeaning=(d:Report['diagnostics'][number])=>{const {range,...meaning}=d;expect(range.start.offset).toBeLessThanOrEqual(range.end.offset);return meaning;};
  expect(report.diagnostics.map(diagnosticMeaning)).toEqual(historical.diagnostics.map(diagnosticMeaning));
  const invoiceDiagnosticRanges=new Map([
    ['Value for bgcolor is dynamic; original retained.',{start:{offset:1136,line:33,column:30},end:{offset:1150,line:33,column:44}}],
    ['Value for color is dynamic; original retained.',{start:{offset:1179,line:34,column:28},end:{offset:1186,line:34,column:35}}],
  ]);
  for(const [i,d] of report.diagnostics.entries()){const source=await readFile(d.path,'utf8');const span=source.slice(d.range.start.offset,d.range.end.offset);expect(span.length).toBeGreaterThan(0);if(d.path==='apps/invoicing/src/components/InvoiceTable.tsx'&&invoiceDiagnosticRanges.has(d.message))expect(d.range).toEqual(invoiceDiagnosticRanges.get(d.message));else if(d.path!=='libs/design-system/src/index.tsx')expect(d.range).toEqual(historical.diagnostics[i].range);else expect(span).toMatch(/^colors\[status\]\[[01]\]$/);}
  expect(report.diagnostics.every(d=>!d.blocking)).toBe(true);
  expect(report.diagnostics.some(d=>d.code.startsWith('POLICY'))).toBe(false);
  expect(report.policyDigest).toBe('fc82bc0137f0800c3c6818b55a14ef2ac9abaeb1b018d503834d9899183abf49');
  expect(report.files).toEqual([...historical.files,runtimePath].sort()); expect(report.skipped).toEqual(historical.skipped);
  expect(json(report)).toBe(json(repeated)); expect(markdown(report)).toBe(markdown(repeated));
  const stylesheet = 'libs/design-system/src/styles.css';
  for (const candidate of pilot) {
    const evidence=report.evidence.filter(e=>e.path===stylesheet&&e.context===candidate.context);
    expect(evidence.filter(e=>e.property==='margin-inline-end')).toEqual([expect.objectContaining({value:candidate.value,original:`margin-inline-end: ${candidate.value};`,mechanism:'css'})]);
    expect(evidence.some(e=>e.property==='margin-right')).toBe(false);
    expect(report.findings.some(f=>f.id===candidate.id)).toBe(false);
  }
  expect(report.evidence.find(e=>e.path===stylesheet&&e.context==='stylesheet/.kpi-note b'&&e.property==='margin-right')).toMatchObject({value:'5px'});
  const removed=new Set([...pilot.map(c=>c.id),'RTL.RUNTIME.MISMATCH:631220ab170fd844366645f4','RTL.RUNTIME.CACHE:c6803b61cf2818cad26b1416','RTL.CSS.PHYSICAL:28c2d60d10633572c611bf0c','RTL.CSS.PHYSICAL:5f4d415396df52ea51e0a5d6','RTL.CSS.PHYSICAL:87c7c8a9a1668b5ed0eb9d9e','RTL.CSS.PHYSICAL:a73f6f180169335db97e8e52','RTL.CSS.PHYSICAL:d64ac5113f2d40f44c75d315','RTL.CSS.PHYSICAL:eef2d882a74a3ca1f4724fc2','RTL.GEOMETRY.COUPLED:cd662af13b746b307885c1c6','RTL.GEOMETRY.EDGE:91f8525674eed0701dd95542','RTL.GEOMETRY.EDGE:a9ac460392929e44328f29fe']);
  const expectedFindings=historical.findings.filter(f=>!removed.has(f.id)).map(f=>f.id==='RTL.DOCUMENT.RUNTIME:12875636fcbc0a9be9a7b6f4'
    ? {...f,id:'RTL.DOCUMENT.RUNTIME:1f3bd0fab5211f473ef82db4',path:runtimePath,context:'Provider'}:f);
  const negativeFinding=historical.findings.find(f=>f.id==='RTL.GEOMETRY.ORDER:0b23a5f6f4bc3966eb9e0efc')!;
  expect(negativeFinding).toBeTruthy();
  expectedFindings.push({...negativeFinding,id:'RTL.GEOMETRY.ORDER:1226abd54e967deed14a4a6c',context:positiveFact.context,original:positiveFact.original,evidenceIds:['bec7eb48070732847dd4606aafc361f8f2f81e80b9bf2ba7be2b637c274781c7']});
  const arrowBackFinding: Finding={"id":"RTL.ICON.PROGRESSION:237172da962fe4d0605ddd83","ruleId":"RTL.ICON.PROGRESSION","ruleVersion":1,"category":"MANUAL_REVIEW","severity":"Minor","confidence":"Medium","title":"Directional icon requires semantic review","sourceMechanism":"typescript-structure","applications":["invoicing"],"path":"apps/invoicing/src/components/InvoiceTable.tsx","range":{"start":{"offset":2455,"line":78,"column":17},"end":{"offset":2508,"line":78,"column":70}},"original":"<ArrowBack sx={{ fontSize: 15, color: \"#9aa2b3\" }} />","context":"InvoiceTable/ArrowBack","ownership":"custom-icon","rationale":"Imported directional icon renders in JSX; navigation meaning and appropriate orientation need review.","treatment":"Distinguish progression from trends/external-link conventions; coordinate MUI-owned roles before mirroring.","evidenceIds":[],"relatedLocations":[],"issueIds":[],"suggestion":null,"limitation":"Static evidence indicates a risk; rendered behavior is not established by this scan."};
  expect(expectedFindings).toHaveLength(46);
  expect(report.findings.find(f=>f.id===arrowBackFinding.id)).toEqual(arrowBackFinding);
  expectedFindings.push(arrowBackFinding);
  expect(report.findings).toHaveLength(47);
  expect(report.findings.filter(f=>!['INFORMATIONAL','INTENTIONAL_LTR'].includes(f.category))).toHaveLength(44);
  expect(report.findings.find(f=>f.id==='RTL.ICON.PROGRESSION:07d33024c457dfcdc175bd85')).toMatchObject({issueIds:['RTL-07']});
  expect(p.issueBindings).toContainEqual({ruleId:'RTL.ICON.PROGRESSION',path:'apps/invoicing/src/components/InvoiceTable.tsx',contextIncludes:'InvoiceTable/ArrowForward',issueId:'RTL-07'});
  expect([...report.findings.map(f=>f.id)].sort()).toEqual(expectedFindings.map(f=>f.id).sort());
  expect(ordered(report.findings.map(findingMeaning))).toEqual(ordered(expectedFindings.map(findingMeaning)));
  expect(report.findings.some(f=>f.category==='AUTO_CANDIDATE')).toBe(false);
  const sources=new Map<string,string>();
  for (const path of report.files) sources.set(path,await readFile(path,'utf8'));
  for (const e of report.evidence) {
    const source=sources.get(e.path)!;
    expect(source.slice(e.range.start.offset,e.range.end.offset)).toBe(e.original);
  }
  for (const f of report.findings.filter(f=>f.sourceMechanism==='css')) {
    const source=sources.get(f.path)!;
    expect(source.slice(f.range.start.offset,f.range.end.offset)).toBe(f.original);
  }
  for (const pin of p.dynamicExceptions) {
    expect(hash(sources.get(pin.path)!)).toBe(pin.sourceDigest);
    expect(report.evidence.some(e=>e.path===pin.path&&e.property===pin.property&&hash(e.value)===pin.valueDigest)).toBe(true);
  }
  for (const exception of p.exceptions) {
    const matches=report.findings.filter(f=>f.ruleId===exception.ruleId&&f.path===exception.path&&f.context===exception.context&&hash(f.original)===exception.originalDigest);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({category:'INTENTIONAL_LTR',exceptionReason:exception.reason});
  }
  expect(report.findings.filter(f=>f.exceptionReason).map(f=>f.category)).toEqual(['INTENTIONAL_LTR','INTENTIONAL_LTR']);
});
it('unsupported schema and unknown rule are explicitly unsupported', () => {
  expect(failure({...base(), schemaVersion: 2}).diagnostic.code).toBe('POLICY_UNSUPPORTED');
  const p = base(); p.exceptions = [{ruleId: 'RTL.UNKNOWN.RULE', path: 'a.css', context: 'x', category: 'INFORMATIONAL', reason: 'test', reviewedBy: 'test', originalDigest: 'a'.repeat(64)}];
  expect(failure(p).diagnostic.code).toBe('POLICY_UNSUPPORTED');
});
for (const field of ['schemaVersion', 'generatedStyleOwner', 'ownership', 'approvals', 'exceptions', 'issueBindings', 'dynamicExceptions', 'roles']) it(`missing required ${field} rejected`, () => {
  const p: Record<string, unknown> = {...base()}; delete p[field]; expect(failure(p).diagnostic.message).toContain('required field');
});
it('unknown nested/top-level fields and unsupported findingId records are not ignored', () => {
  expect(failure({...base(), misspelled: []}).diagnostic.message).toContain('/misspelled');
  const p = base(); p.approvals = [{...approval(), findingId: 'RTL.CSS.PHYSICAL:' + 'a'.repeat(24)} as Policy['approvals'][number]];
  expect(failure(p).diagnostic.message).toContain('/approvals/0/findingId');
});
for (const invalid of [null, [], 12, 'owner']) it(`ownership object rejects ${JSON.stringify(invalid)}`, () => expect(failure({...base(), ownership: invalid}).diagnostic.code).toBe('POLICY_INVALID'));
for (const invalid of ['AUTO_CANDIDATE', 'manual', 2, null]) it(`exception category rejects ${JSON.stringify(invalid)}`, () => {
  const p = base(); p.exceptions = [{ruleId: 'RTL.CSS.PHYSICAL', path: 'a.css', context: 'x', category: invalid as 'INFORMATIONAL', reason: 'test', reviewedBy: 'test', originalDigest: 'a'.repeat(64)}]; expect(failure(p).diagnostic.code).toBe('POLICY_INVALID');
});
it('owner enums, mappings, generated owner and override shapes are strict', () => {
  expect(failure({...base(), generatedStyleOwner: 'custom-css'}).diagnostic.code).toBe('POLICY_INVALID');
  expect(failure({...base(), ownership: {css: 'mui-generated'}}).diagnostic.code).toBe('POLICY_INVALID');
  expect(failure({...base(), ownership: {imaginary: 'custom-css'}}).diagnostic.message).toContain('unknown field');
  expect(failure({...base(), ownerOverrides: [{path:'a.css', context:'x', owner:'invalid', reason:'test'}]}).diagnostic.code).toBe('POLICY_INVALID');
  expect(failure({...base(), ownerOverrides: {}}).diagnostic.code).toBe('POLICY_INVALID');
});
it('primitives and record arrays are never coerced', () => {
  expect(failure({...base(), approvals: {}}).diagnostic.code).toBe('POLICY_INVALID');
  expect(failure({...base(), roles: [null]}).diagnostic.code).toBe('POLICY_INVALID');
  const p = base(); p.approvals = [{...approval(), reviewedBy: 2 as unknown as string}]; expect(failure(p).diagnostic.code).toBe('POLICY_INVALID');
});
for (const path of ['/tmp/a.css', '../a.css', 'apps/../a.css', 'apps//a.css', './a.css', 'C:/a.css', 'apps\\x.css', 'a.css\n']) it(`invalid normalized path ${JSON.stringify(path)}`, () => {
  const p = base(); p.approvals = [{...approval(), path}]; expect(failure(p).diagnostic.message).toContain('repository-relative');
});
for (const digest of ['abc', 'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(63), 123]) it(`invalid SHA digest ${JSON.stringify(digest)}`, () => {
  const p = base(); p.approvals = [{...approval(), sourceDigest: digest as string}]; expect(failure(p).diagnostic.code).toBe('POLICY_INVALID');
});
it('valid Unicode/space-containing relative paths are retained', () => { const p = base(); p.approvals = [{...approval(), path:'apps/x/src/مسافة file.css'}]; expect(valid(p)).toBe(p); });
it('duplicate records and conflicting owner/approval entries are rejected', () => {
  const p = base(); p.approvals = [approval(), approval()]; expect(failure(p).diagnostic.code).toBe('POLICY_DUPLICATE');
  p.approvals = [approval(), {...approval(), logicalProperty:'padding-inline-start'}]; expect(failure(p).diagnostic.code).toBe('POLICY_CONFLICT');
  const q = base(); q.ownerOverrides = [{path:'a.css',context:'x',owner:'custom-css',reason:'fixture'},{path:'a.css',context:'x',owner:'unknown',reason:'fixture'}]; expect(failure(q).diagnostic.code).toBe('POLICY_CONFLICT');
});
it('duplicate JSON object members including escaped keys never overwrite silently', () => {
  const text = JSON.stringify(base()).replace('"schemaVersion":1', '"schemaVersion":1,"schema\\u0056ersion":1');
  expect(() => validatePolicy(JSON.parse(text), text)).toThrow('POLICY_DUPLICATE');
});
it('stale exact approval/source pin is blocking and cannot grant AUTO', async () => {
  const p = base(); p.approvals = [approval()]; expect(auditCss(p)).toEqual([]);
  const d = auditCss(p, '.x{margin-left:3px}'); expect(d[0].code).toBe('POLICY_STALE_APPROVAL'); expect(d[0].blocking).toBe(true);
  await temporary(p, async root => {const report = await scan(root); expect(report.complete).toBe(false); expect(report.findings.every(f => f.category !== 'AUTO_CANDIDATE')).toBe(true); expect(exitCode(report.complete, 8, true)).toBe(2);}, '.x{margin-left:3px}');
});
it('whole-file unrelated change invalidates a semantic pin', () => {const p = base(); p.approvals = [approval()]; expect(auditCss(p, '.x{margin-left:2px} /* unrelated */')[0].code).toBe('POLICY_STALE_APPROVAL');});
it('approval mismatch in owner or logical semantics is blocking', () => {
  const p = base(); p.approvals = [{...approval(), owner:'custom-inline'}]; expect(auditCss(p)[0].code).toBe('POLICY_CONFLICT');
  p.approvals = [{...approval(), logicalProperty:'color'}]; expect(auditCss(p)[0].code).toBe('POLICY_UNSUPPORTED_APPROVAL');
});
it('stale ownership override is blocking; incompatible extracted owner conflicts', () => {
  const p = base(); p.ownerOverrides = [{path:'apps/x/src/a.css',context:'stylesheet/.missing',owner:'custom-css',reason:'fixture'}]; expect(auditCss(p)[0].code).toBe('POLICY_STALE_OVERRIDE'); expect(auditCss(p)[0].blocking).toBe(true);
  p.ownerOverrides[0].context = 'stylesheet/.x'; p.ownerOverrides[0].owner = 'custom-inline'; expect(auditCss(p)[0].code).toBe('POLICY_CONFLICT');
});
it('stale informational reference warns without affecting completeness', async () => {
  const p = base(); p.issueBindings = [{ruleId:'RTL.CSS.PHYSICAL',path:'apps/x/src/a.css',contextIncludes:'missing',issueId:'RTL-01'}];
  await temporary(p, async root => {const a=await scan(root),b=await scan(root);const d=a.diagnostics.find(d=>d.code==='POLICY_STALE_INFORMATIONAL')!;expect(d.blocking).toBe(false);expect(d.message).toContain('WARNING /issueBindings/0');expect(a.complete).toBe(true);expect(json(a)).toBe(json(b));expect(markdown(a)).toBe(markdown(b));expect(exitCode(a.complete,1,false)).toBe(0);expect(exitCode(a.complete,1,true)).toBe(1);expect(d.path).toBe('rtl-scanner.config.json');expect(d.range.start.line).toBeGreaterThan(1);});
});
it('stale informational exception warns, but informational directional suppression blocks', () => {
  const x = {ruleId:'RTL.DOCUMENT.INITIAL',path:'apps/x/index.html',context:'html',category:'INFORMATIONAL' as const,reason:'fixture',reviewedBy:'fixture',originalDigest:'a'.repeat(64)};
  const p = base(); p.exceptions=[x]; expect(auditCss(p)[0].blocking).toBe(false);
  p.exceptions=[{...x,ruleId:'RTL.CSS.PHYSICAL',path:'apps/x/src/a.css',context:'stylesheet/.x'}]; expect(auditCss(p)[0].blocking).toBe(true);
});
it('stale intentional root/directional exceptions block and are not silently applied', async () => {
  const p=base();p.exceptions=[{ruleId:'RTL.DOCUMENT.INITIAL',path:'apps/x/index.html',context:'html',category:'INTENTIONAL_LTR',reason:'fixture English default',reviewedBy:'fixture',originalDigest:hash('dir="ltr"')}];
  await temporary(p,async root=>{expect((await scan(root)).findings.find(f=>f.ruleId==='RTL.DOCUMENT.INITIAL')?.category).toBe('INTENTIONAL_LTR');await writeFile(join(root,'apps/x/index.html'),'<html dir="rtl"></html>');const a=await scan(root);expect(a.complete).toBe(false);expect(a.diagnostics.some(d=>d.code==='POLICY_STALE_EXCEPTION'&&d.blocking)).toBe(true);expect(a.findings.find(f=>f.ruleId==='RTL.DOCUMENT.INITIAL')?.category).toBe('INFORMATIONAL');});
});
it('dynamic-background matching and both changed-expression/source diagnostics', () => {
  const path='apps/x/src/a.tsx',s='<div style={{background:colors[status]}}/>;',p=base();p.dynamicExceptions=[{path,property:'background',valueDigest:hash('colors[status]'),sourceDigest:hash(s),reason:'fixture colors'}];
  function run(text:string){const e=extractTypescript(path,text),sources=new Map([[path,text]]),d=classifyDiagnostics(e.diagnostics,e.evidence,sources,p);return {coverage:d,audit:auditPolicy(p,JSON.stringify(p),e.evidence,sources,[],d)};}
  expect(run(s).audit).toEqual([]);expect(run(s).coverage[0].blocking).toBe(false);
  for(const changed of [s+' ',s.replace('colors[status]','other[status]')]){const a=run(changed);expect(a.audit[0].code).toBe('POLICY_STALE_DYNAMIC_EXCEPTION');expect(a.audit[0].blocking).toBe(true);expect(a.coverage[0].blocking).toBe(true);}
});
it('unmatched dynamic exception is blocking even when no dynamic diagnostic remains', () => {const p=base();p.dynamicExceptions=[{path:'apps/x/src/a.css',property:'background',valueDigest:hash('paint()'),sourceDigest:hash('.x{margin-left:2px}'),reason:'fixture'}];expect(auditCss(p)[0].code).toBe('POLICY_STALE_DYNAMIC_EXCEPTION');});
it('parser coverage remains distinct from unmatched source policy', () => {
  const p=base();p.approvals=[approval()];const d=auditPolicy(p,JSON.stringify(p),[],new Map(),[],[{path:'apps/x/src/a.css',range:{start:{offset:0,line:1,column:1},end:{offset:0,line:1,column:1}},code:'CSS_PARSE',impact:'SOURCE_FAILURE',blocking:true,message:'bad css'}]);expect(d[0].code).toBe('POLICY_UNSUPPORTED');
});
it('finding identities validate shape, rule agreement and duplicates without a new approval field', () => {
  const p=base(),s='.x{margin-left:2px}',e=extractCss('apps/x/src/a.css',s),sources=new Map([['apps/x/src/a.css',s]]),f=detect(e.evidence,sources,p,[])[0];
  for(const id of ['RTL.CSS.PHYSICAL:broken','RTL.CSS.SHORTHAND:'+'a'.repeat(24)])expect(auditPolicy(p,JSON.stringify(p),e.evidence,sources,[{...f,id}],[])[0].code).toBe('POLICY_FINDING_ID_INVALID');
  expect(auditPolicy(p,JSON.stringify(p),e.evidence,sources,[f,{...f}],[])[0].blocking).toBe(true);
  expect(auditPolicy(p,JSON.stringify(p),e.evidence,sources,[f] as Finding[],[])).toEqual([]);
});
it('policy diagnostics have exact CRLF/UTF-16 record positions and deterministic order', () => {
  const p=base();p.ownerOverrides=[{path:'apps/x/src/a.css',context:'missing',owner:'custom-css',reason:'عربي 😀'}];const text=JSON.stringify(p,null,2).replace(/\n/g,'\r\n');const d=auditPolicy(p,text,[],new Map(),[],[])[0];expect(text.slice(d.range.start.offset,d.range.end.offset)).toContain('"reason": "عربي 😀"');expect(d.range.start.column).toBe(5);expect(d).toEqual(auditPolicy(p,text,[],new Map(),[],[])[0]);
});
it('malformed JSON and symlink policy input fail safely', async () => {
  await temporary(base(),async root=>{await writeFile(join(root,'rtl-scanner.config.json'),'{bad');await expect(loadPolicy(root)).rejects.toThrow('POLICY_INVALID_JSON');await rm(join(root,'rtl-scanner.config.json'));await writeFile(join(root,'other.json'),JSON.stringify(base()));await symlink('other.json',join(root,'rtl-scanner.config.json'));await expect(loadPolicy(root)).rejects.toThrow('POLICY_INVALID_PATH');});
});
it('negative JSON fixtures reject broad implied approval and conflicting ownership', async () => {
  for (const [file,code] of [['policy-unknown-field.json','POLICY_INVALID'],['policy-conflicting-owners.json','POLICY_CONFLICT']]) {
    const text=await readFile(`tools/rtl-scanner/tests/fixtures/${file}`,'utf8');
    try {validatePolicy(JSON.parse(text),text);throw new Error('Expected fixture failure');} catch(e) {expect(e).toBeInstanceOf(PolicyError);expect((e as PolicyError).diagnostic.code).toBe(code);}
  }
});
it('duplicate exception/dynamic/role/binding/override records are rejected',()=>{
  const records = {
    exceptions:{ruleId:'RTL.DOCUMENT.INITIAL',path:'apps/x/index.html',context:'html',category:'INTENTIONAL_LTR',reason:'fixture',reviewedBy:'fixture',originalDigest:hash('dir="ltr"')},
    dynamicExceptions:{path:'apps/x/src/a.tsx',property:'background',valueDigest:hash('paint()'),sourceDigest:hash('source'),reason:'fixture'},
    roles:{kind:'brand',path:'apps/x/src/a.tsx',className:'brand'},
    issueBindings:{ruleId:'RTL.CSS.PHYSICAL',path:'apps/x/src/a.css',contextIncludes:'.x',issueId:'RTL-01'},
    ownerOverrides:{path:'apps/x/src/a.css',context:'stylesheet/.x',owner:'custom-css',reason:'fixture'},
  };
  for(const [name,entry] of Object.entries(records))expect(failure({...base(),[name]:[entry,{...entry}]}).diagnostic.code).toBe('POLICY_DUPLICATE');
});
it('a valid MUI sx approval remains unsupported and cannot automate aliases',()=>{
  const path='apps/x/src/a.tsx',s='import {Box} from "@mui/material";<Box sx={{ml:2}}/>;',p=base();p.ownership['mui-sx']='custom-emotion-logical';const e=extractTypescript(path,s),sources=new Map([[path,s]]),evidence=e.evidence[0];
  p.approvals=[{...approval(),path,context:evidence.context,property:evidence.property,value:evidence.value,owner:'custom-emotion-logical',logicalProperty:'marginInlineStart',sourceDigest:hash(s)}];valid(p);
  const coverage=classifyDiagnostics(e.diagnostics,e.evidence,sources,p);const f=detect(e.evidence,sources,{...p,approvals:[]},coverage);
  expect(auditPolicy(p,JSON.stringify(p),e.evidence,sources,f,coverage)[0].code).toBe('POLICY_UNSUPPORTED_APPROVAL');
});
it('missing policy file stays compatible with default read-only scan',async()=>{
  await temporary(base(),async root=>{await rm(join(root,'rtl-scanner.config.json'));expect((await scan(root)).complete).toBe(true);expect(await loadPolicy(root)).toEqual(emptyPolicy);});
});
it('source/expression matches do not exempt a record that no longer matches dynamic evidence',()=>{
  const path='apps/x/src/a.tsx',s='<div style={{background:"red"}}/>;',p=base();p.dynamicExceptions=[{path,property:'background',valueDigest:hash('"red"'),sourceDigest:hash(s),reason:'fixture'}];const e=extractTypescript(path,s);const d=auditPolicy(p,JSON.stringify(p),e.evidence,new Map([[path,s]]),[],[]);expect(d[0].code).toBe('POLICY_STALE_DYNAMIC_EXCEPTION');expect(d[0].blocking).toBe(true);
});
it('rejected raw policy cannot mutate inputs or return a policy object',()=>{
  const p={...base(),roles:[{kind:'invalid',path:'apps/x/src/a.tsx',className:'brand'}]},before=JSON.stringify(p);expect(()=>valid(p)).toThrow(PolicyError);expect(JSON.stringify(p)).toBe(before);
});

it('dynamic directional-value exceptions cannot expand the reviewed background catalog',()=>{
 const p=base();p.dynamicExceptions=[{path:'apps/x/src/a.tsx',property:'left',valueDigest:hash('offset()'),sourceDigest:hash('source'),reason:'fixture'}];expect(failure(p).diagnostic.code).toBe('POLICY_INVALID');
});

it('approval cannot conflict with an exception on the same declaration',()=>{
 const p=base();p.approvals=[approval()];p.exceptions=[{ruleId:'RTL.CSS.PHYSICAL',path:'apps/x/src/a.css',context:'stylesheet/.x',category:'INTENTIONAL_LTR',originalDigest:hash('margin-left:2px'),reason:'fixture',reviewedBy:'fixture'}];expect(auditCss(p)[0].code).toBe('POLICY_CONFLICT');
});
it('existing unsupported candidate safeguards are not bypassed by source-pinned approval',()=>{
 for(const s of ['.x{margin-left:var(--gap)}','.x{position:absolute;margin-left:2px}','.x{writing-mode:vertical-rl;margin-left:2px}']){
  const p=base();p.approvals=[{...approval(s),value:s.includes('var(')?'var(--gap)':'2px'}];expect(auditCss(p,s)[0].code).toBe('POLICY_UNSUPPORTED_APPROVAL');
 }
});

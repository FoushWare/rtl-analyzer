/**
 * Atlas historical golden tests.
 *
 * These preserve the original assertions exactly, but require the excluded
 * Atlas report corpus and source tree. Run explicitly with:
 *   vitest run --config tools/rtl-scanner/vitest.historical.config.ts
 */
import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { emptyPolicy, loadPolicy, type Policy } from '../src/policy.js';
import { hash, type Finding, type Report } from '../src/model.js';
import { scan } from '../src/scan.js';
import { json, markdown } from '../src/report.js';

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

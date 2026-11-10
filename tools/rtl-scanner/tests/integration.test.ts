import { it,expect } from 'vitest';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan } from '../src/scan.js';
import { json,markdown } from '../src/report.js';
import { exitCode } from '../src/coverage.js';
it('Atlas actual inventory maps reference evidence without approving transformations',async()=>{
 const a=await scan(process.cwd()),b=await scan(process.cwd());const prepared = a.evidence.filter(e=>e.path==='libs/design-system/src/runtime.tsx'&&e.context.startsWith('rtlTheme/'));
 const expectedPrepared = [
  [
    "9a594b91eb9e5b9b4c785e5d610818690118b67a765d041edfc64a330ce3c0eb",
    "rtlTheme/styleOverrides/root",
    "padding",
    "\"10px 18px\""
  ],
  [
    "a48581f39558ed46458dedf7a0754d46b115744a4576fe5eb915ba85d664aa9e",
    "rtlTheme/styleOverrides/root",
    "borderColor",
    "\"#edf0f5\""
  ],
  [
    "956dbec8395fe4fab29df73ae86d519b1ee0ebc0c4374e0b02c03691a0e04781",
    "rtlTheme/styleOverrides/root",
    "padding",
    "\"17px 20px\""
  ],
  [
    "1a4c87cb4eb1909dc3804ea10069730131dcf1e0a5311b4dd1e8317a27f4bedc",
    "rtlTheme/styleOverrides/head",
    "fontSize",
    "11"
  ],
  [
    "5531274823f03e7459808f91f9362818b8c2c38eeb45d88b65d3e63d89f68972",
    "rtlTheme/styleOverrides/head",
    "fontWeight",
    "700"
  ],
  [
    "d7b4537bbcac3c815b21ceb7fbfb440699e37203a1c6d46017a87d5a1aebd5e3",
    "rtlTheme/styleOverrides/head",
    "color",
    "\"#80889a\""
  ],
  [
    "6cd70ca50f346593c75c612a803a595da001aaa6e63f53b4b1de8c48a6dc5cd7",
    "rtlTheme/styleOverrides/head",
    "letterSpacing",
    "\".6px\""
  ],
  [
    "25f99f547bb86932344f18c5e675c1f5622689eaeeb495207ec2b28ded3b073b",
    "rtlTheme/styleOverrides/head",
    "background",
    "\"#fafbfc\""
  ]
];
 expect(prepared.map(e=>[e.id,e.context,e.property,e.value])).toEqual(expectedPrepared);
 const relocated=a.evidence.filter(e=>e.path==='libs/design-system/src/runtime.tsx'&&e.context.startsWith('theme/'));
 expect(relocated.map(e=>[e.context.replace('theme/','rtlTheme/'),e.property,e.value,e.original,e.semantics])).toEqual(prepared.map(e=>[e.context,e.property,e.value,e.original,e.semantics]));
 const rtlClosed=a.evidence.filter(e=>e.path==='libs/design-system/src/index.tsx'&&e.context==='SidebarFrame/@media (max-width: 900px)/html[dir="rtl"] &:not(.is-open)'&&e.property==='transform');
 expect(rtlClosed).toEqual([expect.objectContaining({id:'bec7eb48070732847dd4606aafc361f8f2f81e80b9bf2ba7be2b637c274781c7',value:'translateX(100%)',original:'transform: translateX(100%);',mechanism:'emotion-template'})]);
 const chartDirections=a.evidence.filter(e=>e.path==='libs/design-system/src/styles.css'&&['stylesheet/.chart-wrap','stylesheet/html[dir="rtl"] .chart-labels span'].includes(e.context)&&['direction','unicode-bidi'].includes(e.property));
 expect(chartDirections.map(({id,context,property,value,original,mechanism})=>({id,context,property,value,original,mechanism}))).toEqual([{"id": "1bf7b75bdfa1d9af75dc1afc3c1748a8290739255c0729446756591a3a89421f", "context": "stylesheet/.chart-wrap", "property": "direction", "value": "ltr", "original": "direction: ltr;", "mechanism": "css"}, {"id": "2b41fab3c84c8c5b706c0192481d4b6d41f8f27691965e7b313cc43eb8740bde", "context": "stylesheet/html[dir=\"rtl\"] .chart-labels span", "property": "direction", "value": "rtl", "original": "direction: rtl;", "mechanism": "css"}, {"id": "091e232dd6c0060059025125d78d0011a48fd31736d922831fac711a64942ef4", "context": "stylesheet/html[dir=\"rtl\"] .chart-labels span", "property": "unicode-bidi", "value": "isolate", "original": "unicode-bidi: isolate;", "mechanism": "css"}]);
 const brandDirection=a.evidence.filter(e=>e.path==='libs/design-system/src/styles.css'&&e.context==='stylesheet/.brand'&&e.property==='direction');
 expect(brandDirection).toEqual([expect.objectContaining({id:'6bf8bbaa631fcb5e992d714826b7e9904bb1440572bbe2cd8df6fe650fcdd978',value:'ltr',original:'direction: ltr;',mechanism:'css'})]);
 const arrowBack=a.evidence.filter(e=>e.path==='apps/invoicing/src/components/InvoiceTable.tsx'&&e.context==='InvoiceTable/ArrowBack');
 expect(arrowBack).toEqual([{"id":"32869cf5037c74759f509f79dfeb84bfffe2289a939313afeb0cf4541aa3e221","path":"apps/invoicing/src/components/InvoiceTable.tsx","mechanism":"mui-sx","context":"InvoiceTable/ArrowBack","property":"fontSize","value":"15","original":"fontSize: 15","range":{"start":{"offset":2472,"line":78,"column":34},"end":{"offset":2484,"line":78,"column":46}},"semantics":"mui-system"},{"id":"f05e60a9be9bc2433fb95fc3c40c60a082d02143d4d6f1fa7d7e5f7a9fd7d57e","path":"apps/invoicing/src/components/InvoiceTable.tsx","mechanism":"mui-sx","context":"InvoiceTable/ArrowBack","property":"color","value":"\"#9aa2b3\"","original":"color: \"#9aa2b3\"","range":{"start":{"offset":2486,"line":78,"column":48},"end":{"offset":2502,"line":78,"column":64}},"semantics":"mui-system"}]);
 expect(a.evidence.find(e=>e.id==='ac7e998160b4c8f482d48521712d68062325e5b7cb138b7a0c39d326f2dafe8a')).toEqual({"id":"ac7e998160b4c8f482d48521712d68062325e5b7cb138b7a0c39d326f2dafe8a","path":"libs/design-system/src/styles.css","mechanism":"css","context":"stylesheet/html[dir=\"rtl\"] .app-link > svg:last-child","property":"transform","value":"scaleX(-1)","original":"transform: scaleX(-1);","range":{"start":{"offset":1231,"line":81,"column":3},"end":{"offset":1253,"line":81,"column":25}},"semantics":"css","tokens":["scaleX(-1)"]});
 expect(a.evidence.filter(e=>!prepared.includes(e)&&!rtlClosed.includes(e)&&!chartDirections.includes(e)&&!brandDirection.includes(e)&&!arrowBack.includes(e))).toHaveLength(420);
expect(a.complete).toBe(true);expect(a.diagnostics).toHaveLength(9);expect(a.diagnostics.every(d=>d.blocking===false)).toBe(true);expect(a.findings.filter(f=>f.category==='AUTO_CANDIDATE')).toEqual([]);expect(new Set(a.findings.flatMap(f=>f.issueIds))).toEqual(new Set(['RTL-01','RTL-02','RTL-04','RTL-05','RTL-06','RTL-07','RTL-08','RTL-09']));expect(json(a)).toBe(json(b));expect(markdown(a)).toBe(markdown(b));
 // RTL-03's migrated physical edge has no remaining static risk anchor;
 // glyph-level acceptance remains in the KPI Playwright tests.
 expect(a.evidence.some(e=>e.id==='8a3e01bf8921994351feaad17075e22e5478351f582cc49c05b94c4ccf76beec')).toBe(false);
 expect(a.evidence.filter(e=>e.path==='libs/design-system/src/styles.css'&&e.context==='stylesheet/.kpi-icon'&&e.property==='inset-inline-end')).toEqual([expect.objectContaining({id:'e902bd05092989687628f1dee71f17c5927277e08fb9f3a0d062a15f48a4a5ef',value:'20px',original:'inset-inline-end: 20px;'})]);
 expect(a.findings.some(f=>f.id==='RTL.GEOMETRY.EDGE:a9ac460392929e44328f29fe')).toBe(false);
 for(const f of a.findings){const s=await readFile(f.path,'utf8');expect(s.slice(f.range.start.offset,f.range.end.offset)).toBe(f.original);expect(f.rationale.length).toBeGreaterThan(0);expect(f.treatment.length).toBeGreaterThan(0);expect(f.suggestion).toBeNull();}
});
it('temporary Nx directional unsupported input cannot report complete',async()=>{const root=await mkdtemp(join(tmpdir(),'atlas-detection-'));try{await mkdir(join(root,'apps/x/src'),{recursive:true});await mkdir(join(root,'libs'));await writeFile(join(root,'apps/x/project.json'),'{"sourceRoot":"apps/x/src"}');await writeFile(join(root,'apps/x/index.html'),'<html dir="ltr"></html>');await writeFile(join(root,'apps/x/src/test.tsx'),'<div style={{left:dynamic}}/>;');const a=await scan(root);expect(a.complete).toBe(false);expect(exitCode(a.complete,a.findings.length,false)).toBe(2);await writeFile(join(root,'apps/x/src/test.tsx'),'<div style={{color:dynamic}}/>;');const b=await scan(root);expect(b.complete).toBe(true);expect(exitCode(b.complete,b.findings.length,false)).toBe(0);}finally{await rm(root,{recursive:true,force:true});}});
it('invalid policy fails explicitly rather than executing or ignoring config',async()=>{const root=await mkdtemp(join(tmpdir(),'atlas-policy-'));try{await mkdir(join(root,'apps'));await mkdir(join(root,'libs'));await writeFile(join(root,'rtl-scanner.config.json'),'{"schemaVersion":99}');await expect(scan(root)).rejects.toThrow('Invalid scanner policy');}finally{await rm(root,{recursive:true,force:true});}});

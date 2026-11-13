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
it('malformed JSON and symlink policy input fail safely', async ({ skip }) => {
  await temporary(base(), async root => {
    await writeFile(join(root, 'rtl-scanner.config.json'), '{bad');
    await expect(loadPolicy(root)).rejects.toThrow('POLICY_INVALID_JSON');
    await rm(join(root, 'rtl-scanner.config.json'));
    await writeFile(join(root, 'other.json'), JSON.stringify(base()));
    try {
      await symlink('other.json', join(root, 'rtl-scanner.config.json'));
    } catch (error) {
      if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') {
        skip('Windows file symlink fixture requires privileges unavailable in this environment');
        return;
      }
      throw error;
    }
    await expect(loadPolicy(root)).rejects.toThrow('POLICY_INVALID_PATH');
  });
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

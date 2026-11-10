import { readdir, readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { extractCss } from './css.js';
import { extractHtml } from './html.js';
import { extractTypescript } from './typescript.js';
import { detect } from './rules.js';
import { loadPolicy, policySourceText } from './policy.js';
import { auditPolicy } from './policy-audit.js';
import { classifyDiagnostics } from './coverage.js';
import { hash, type Report } from './model.js';
export async function scan(root:string):Promise<Report> {
  const files:string[]=[], skipped:string[]=[];
  async function walk(relative:string){for(const e of (await readdir(join(root,relative),{withFileTypes:true})).sort((a,b)=>a.name<b.name?-1:1)){
    const p=`${relative}/${e.name}`; if(e.isSymbolicLink()){skipped.push(p);continue;}
    if(e.isDirectory()){if(!['node_modules','dist','.nx','.git'].includes(e.name))await walk(p);}
    else if(/\.(css|tsx?|jsx?|html)$/.test(p)&&!p.endsWith('.stories.tsx'))files.push(p);else skipped.push(p);
  }}
  // Read Nx metadata as JSON, never execute configuration or plugins.
  for(const group of ['apps','libs']){if((await lstat(join(root,group))).isSymbolicLink())throw new Error('Symlink project group not permitted');}
  for(const group of ['apps','libs'])for(const dir of (await readdir(join(root,group))).sort()){
    const base=`${group}/${dir}`;if(!(await lstat(join(root,base))).isDirectory())continue;
    const metadata=JSON.parse(await readFile(join(root,base,'project.json'),'utf8')) as {sourceRoot:string};
    if(!metadata.sourceRoot.startsWith(base+'/')||metadata.sourceRoot.includes('..'))throw new Error('Invalid sourceRoot');
    if((await lstat(join(root,metadata.sourceRoot))).isSymbolicLink())throw new Error('Symlink sourceRoot not permitted');
    await walk(metadata.sourceRoot);
    if(group==='apps'){if((await lstat(join(root,base,'index.html'))).isSymbolicLink())throw new Error('Symlink HTML not permitted');files.push(base+'/index.html');}
  }
  files.sort();const evidence:Report['evidence']=[],diagnostics:Report['diagnostics']=[],inputs:string[]=[],sources=new Map<string,string>();const policy=await loadPolicy(root);
  for(const p of files){const s=await readFile(join(root,p),'utf8');inputs.push(p+'\0'+s);sources.set(p,s);if(s.length>2_000_000)throw new Error('Source exceeds size limit');const r=p.endsWith('.css')?extractCss(p,s):p.endsWith('.html')?extractHtml(p,s):extractTypescript(p,s);evidence.push(...r.evidence);diagnostics.push(...r.diagnostics);}
  const compare=(a:{path:string;range:{start:{offset:number}}},b:typeof a)=>a.path<b.path?-1:a.path>b.path?1:a.range.start.offset-b.range.start.offset;
  evidence.sort(compare);diagnostics.sort(compare);
  const occurrences=new Map<string,number>();
  for(const e of evidence){const anchor=[e.path,e.mechanism,e.context,e.property,e.value].join('|');const ordinal=occurrences.get(anchor)??0;occurrences.set(anchor,ordinal+1);e.id=hash(anchor+'|'+ordinal);}
  for(const p of skipped)if(/\.(scss|sass|less|styl|css|tsx?|jsx?)$/.test(p)&&!p.endsWith('.stories.tsx'))diagnostics.push({path:p,code:'SOURCE_COVERAGE',message:'Unsupported or skipped source may contain directional styling; source not followed.',range:{start:{offset:0,line:1,column:1},end:{offset:0,line:1,column:1}}});
  const coverage=classifyDiagnostics(diagnostics,evidence,sources,policy);
  // Audit against original risk anchors, with exceptions/approvals disabled. Roles remain
  // source metadata so existing brand associations can be matched without changing rules.
  const auditCoverage=coverage.map(d=>({...d}));
  const anchors=detect(evidence,sources,{...policy,approvals:[],exceptions:[],ownerOverrides:[]},auditCoverage);
  const policyDiagnostics=auditPolicy(policy,policySourceText(policy),evidence,sources,anchors,coverage);
  coverage.push(...policyDiagnostics);
  // Blocking policy uncertainty must not apply any effect-bearing policy records.
  const effectivePolicy=policyDiagnostics.some(d=>d.blocking)?{...policy,approvals:[],exceptions:[],dynamicExceptions:[],ownerOverrides:[]}:policy;
  if(effectivePolicy!==policy){coverage.splice(0,coverage.length,...classifyDiagnostics(diagnostics,evidence,sources,effectivePolicy),...policyDiagnostics);}
  const findings=detect(evidence,sources,effectivePolicy,coverage);coverage.sort(compare);
  const count=(key:'category'|'severity'|'confidence')=>Object.fromEntries([...new Set(findings.map(f=>f[key]))].sort().map(v=>[v,findings.filter(f=>f[key]===v).length]));
  const metrics={byCategory:count('category'),bySeverity:count('severity'),byConfidence:count('confidence'),uniqueAffectedFiles:new Set(findings.map(f=>f.path)).size,referenceCaseIds:[...new Set(findings.flatMap(f=>f.issueIds))].sort()};
  return {schemaVersion:2,kind:'rtl-risk-report',policyDigest:hash(JSON.stringify(policy)),inputDigest:hash(inputs.join('\0')),files,skipped:skipped.sort(),evidence,diagnostics:coverage,findings,metrics,complete:!coverage.some(d=>d.blocking)};
}

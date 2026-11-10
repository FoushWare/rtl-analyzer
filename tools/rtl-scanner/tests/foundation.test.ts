import { describe,it,expect } from 'vitest';
import { mkdtemp,writeFile,mkdir,readFile,readdir,stat,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractCss } from '../src/css.js';
import { extractTypescript } from '../src/typescript.js';
import { extractHtml } from '../src/html.js';
import { scan } from '../src/scan.js';
import { json,markdown } from '../src/report.js';
import { range } from '../src/model.js';
describe('foundation',()=>{
 it('UTF16 CRLF and Unicode',()=>{expect(range('😀\r\nx',2,5)).toEqual({start:{offset:2,line:1,column:3},end:{offset:5,line:2,column:2}});});
 it('CSS exact original offsets and shorthand tokens',async()=>{const s=await readFile('tools/rtl-scanner/tests/fixtures/styles.css','utf8');const r=extractCss('a.css',s);expect(r.evidence).toHaveLength(3);for(const e of r.evidence)expect(s.slice(e.range.start.offset,e.range.end.offset)).toBe(e.original);expect(r.evidence[1].tokens?.join('')).toBe('calc(2px + 1px) 4px');});
 it('CSS parse diagnostic',()=>expect(extractCss('a.css','.a {').diagnostics[0].code).toBe('CSS_PARSE'));
 it('Emotion raw mapping',()=>{const s='import styled from "@emotion/styled"; const A=styled.aside`\r\n left: 0;\r\n`;';const r=extractTypescript('a.tsx',s);expect(r.evidence[0].original).toContain('left: 0');expect(r.evidence[0].range.start.line).toBe(2);});
 it('Emotion interpolation is opaque',()=>{const r=extractTypescript('a.tsx','import styled from "@emotion/styled";const A=styled.div`left: 0; color: ${bad()};\n right: 2px;`;');expect(r.diagnostics.some(d=>d.code==='EMOTION_INTERPOLATION')).toBe(true);expect(r.evidence.map(e=>e.property)).toEqual(['left','right']);});
 it('escaped templates are diagnosed',()=>expect(extractTypescript('a.tsx','import styled from "@emotion/styled";const A=styled.div`content: "\\\\";`;').diagnostics[0].code).toBe('TEMPLATE_ESCAPE'));
 it('MUI aliases arrays responsive and React units',()=>{const r=extractTypescript('a.tsx','import {Box} from "@mui/material";const A=()=> <Box sx={[{ml:2,padding:{xs:1,md:2}},callback]} style={{marginLeft:2}}/>;');expect(r.evidence.map(e=>e.semantics)).toEqual(['mui-theme-spacing','mui-theme-spacing','mui-theme-spacing','react-css']);expect(r.evidence[0].property).toBe('marginLeft');expect(r.diagnostics[0].code).toBe('UNRESOLVED_STYLE');});
 it('theme override extraction',()=>{const r=extractTypescript('a.ts','import {createTheme as theme} from "@mui/material/styles";theme({components:{MuiBox:{styleOverrides:{root:{marginLeft:2}}}}});');expect(r.evidence[0].mechanism).toBe('mui-theme');expect(r.evidence[0].semantics).toBe('emotion-css');});
 it('dynamic and computed props remain diagnostics',()=>{const r=extractTypescript('a.tsx','const A=()=> <div style={{left:foo,...other,[key]:2}}/>;');expect(r.diagnostics).toHaveLength(3);expect(r.evidence[0].value).toBe('foo');});
 it('unrecognized sx not falsely accepted',()=>expect(extractTypescript('a.tsx','<Custom sx={{left:2}}/>').diagnostics[0].code).toBe('UNRESOLVED_SX_OWNER'));
 it('HTML root source spans',()=>{const s='<!doctype html>\r\n<html lang="ar" dir="rtl"><body></body></html>';const r=extractHtml('a.html',s);expect(r.evidence.map(e=>e.value)).toEqual(['ar','rtl']);expect(r.evidence[1].original).toBe('dir="rtl"');});
 it('invalid TS diagnostics',()=>expect(extractTypescript('a.tsx','const x = <').diagnostics.some(d=>d.code==='TS_PARSE')).toBe(true));
 it('deterministic read-only scans in different roots',async()=>{
 const roots=await Promise.all([mkdtemp(join(tmpdir(),'atlas-scan-')),mkdtemp(join(tmpdir(),'atlas-scan-'))]);
 try {for(const root of roots){await mkdir(join(root,'apps/a/src'),{recursive:true});await mkdir(join(root,'libs'));await writeFile(join(root,'apps/a/project.json'),JSON.stringify({sourceRoot:'apps/a/src'}));await writeFile(join(root,'apps/a/index.html'),'<html dir="ltr"></html>');await writeFile(join(root,'apps/a/src/z.css'),'.z{left:0}');}
 const p=join(roots[0],'apps/a/src/z.css');const before=await stat(p);const a=await scan(roots[0]),b=await scan(roots[0]),c=await scan(roots[1]);expect(json(a)).toBe(json(b));expect(json(a)).toBe(json(c));expect(markdown(a)).toBe(markdown(b));expect(a.findings.every(f=>f.ruleId==='RTL.CSS.PHYSICAL'||f.ruleId==='RTL.GEOMETRY.EDGE'||f.ruleId==='RTL.DOCUMENT.INITIAL')).toBe(true);expect((await stat(p)).mtimeMs).toBe(before.mtimeMs);expect(await readdir(roots[0])).toEqual(['apps','libs']);expect(await readFile(p,'utf8')).toBe('.z{left:0}');}finally{await Promise.all(roots.map(r=>rm(r,{recursive:true,force:true})));}
 });
});
it('callback extraction does not execute callback',()=>{const r=extractTypescript('a.tsx','import {Box} from "@mui/material";<Box sx={()=>({ml:2})}/>');expect(r.evidence[0].property).toBe('marginLeft');expect(r.diagnostics[0].code).toBe('STYLE_CALLBACK');});
it('shadowed constants are not guessed',()=>{const r=extractTypescript('a.tsx','const s={left:1};function A(){const s={right:2};return <div style={s}/>;}');expect(r.evidence).toEqual([]);expect(r.diagnostics[0].code).toBe('UNRESOLVED_STYLE');});
it('html malformed attributes diagnosed',()=>expect(extractHtml('a.html','<html dir="rtl" dir="ltr"></html>').diagnostics.length).toBeGreaterThan(0));
it('TSX file fixture extraction spans',async()=>{const s=await readFile('tools/rtl-scanner/tests/fixtures/styles.tsx','utf8');const r=extractTypescript('fixture.tsx',s);expect(r.diagnostics).toEqual([]);expect(new Set(r.evidence.map(e=>e.mechanism))).toEqual(new Set(['emotion-template','mui-sx','react-inline']));for(const e of r.evidence)expect(s.slice(e.range.start.offset,e.range.end.offset)).toBe(e.original);});
it('HTML file fixture extraction',async()=>expect(extractHtml('fixture.html',await readFile('tools/rtl-scanner/tests/fixtures/index.html','utf8')).evidence).toHaveLength(2));
it('Unicode CRLF CSS spans use original code units',()=>{const s='.😀 {\r\n margin-left: 2px;\r\n}';const e=extractCss('a.css',s).evidence[0];expect(e.range.start.line).toBe(2);expect(e.range.start.column).toBe(2);expect(e.range.start.offset).toBe(s.indexOf('margin-left'));});
it('CSS nested media selector context',()=>expect(extractCss('a.css','@media (width < 900px){.a{left:0}}').evidence[0].context).toBe('stylesheet/@media (width < 900px)/.a'));
it('nonstyle physical key is not extracted',()=>expect(extractTypescript('a.ts','const data={left:1};').evidence).toEqual([]));

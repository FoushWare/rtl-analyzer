import { parse } from "parse5";
import { fact, range, type Diagnostic, type Evidence } from "./model.js";
export function extractHtml(path: string, text: string) {
  const evidence: Evidence[] = [];
  const diagnostics:Diagnostic[]=[];
  const doc = parse(text,{sourceCodeLocationInfo:true,onParseError:e=>{if(e.code!=='missing-doctype')diagnostics.push({path,code:'HTML_PARSE',message:e.code,range:range(text,e.startOffset,e.endOffset)});}});
  function walk(n: typeof doc | (typeof doc.childNodes)[number]) {
    if ('tagName' in n && n.tagName === 'html') {
      for (const attr of n.attrs.filter(a => ['dir','lang'].includes(a.name))) {
        const loc = n.sourceCodeLocation?.attrs?.[attr.name];
        if (loc) evidence.push(fact(path,text,'html-root','html',attr.name,attr.value,loc.startOffset,loc.endOffset,'initial-document-attribute'));
      }
    }
    if ('childNodes' in n) n.childNodes.forEach(walk);
  }
  walk(doc); return { evidence, diagnostics };
}

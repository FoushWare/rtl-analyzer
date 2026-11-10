import postcss from "postcss";
import valueParser from "postcss-value-parser";
import { fact, range, type Evidence, type Diagnostic, type Mechanism } from "./model.js";
export function extractCss(path: string, original: string, fragment = original, base = 0, mechanism: Mechanism = "css", context = "stylesheet") {
  const evidence: Evidence[] = [], diagnostics: Diagnostic[] = [];
  try {
    const root = postcss.parse(fragment, { from: undefined });
    root.walkDecls(d => {
      const start = base + d.source!.start!.offset!, end = base + d.source!.end!.offset!;
      const parents: string[] = []; let p = d.parent;
      while (p && p.type !== "root") { parents.unshift(p.type === "rule" ? p.selector : p.type === "atrule" ? `@${p.name} ${p.params}` : 'container'); p = p.parent; }
      evidence.push(fact(path,original,mechanism,`${context}/${parents.join("/")}`,d.prop,d.value,start,end,"css",valueParser(d.value).nodes.map(n=>valueParser.stringify(n))));
    });
  } catch { diagnostics.push({ path, code: "CSS_PARSE", message: "CSS fragment could not be parsed; coverage incomplete.", range: range(original,base,base+fragment.length) }); }
  return { evidence, diagnostics };
}

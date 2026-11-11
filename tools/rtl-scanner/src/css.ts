import postcss from "postcss";
import scss from "postcss-scss";
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

export function extractScss(path: string, original: string) {
  const evidence: Evidence[] = [], diagnostics: Diagnostic[] = [];
  const coverage = (message: string, start: number, end: number) => diagnostics.push({path, code: 'SOURCE_COVERAGE', message, range: range(original, start, end)});
  if (/@(?:use|forward|import)\b/.test(original)) coverage('SCSS imports are not resolved; coverage is incomplete.', 0, original.length);
  if (/#\{/.test(original)) coverage('SCSS interpolation is not evaluated; coverage is incomplete.', 0, original.length);
  if (/@(?:mixin|include)\b/.test(original)) coverage('SCSS mixins are not expanded; coverage is incomplete.', 0, original.length);
  try {
    const root = scss.parse(original, { from: undefined });
    root.walkDecls(d => {
      if (/#\{/.test(original)) return;
      let parent = d.parent, insideMixin = false;
      while (parent && parent.type !== 'root') { if (parent.type === 'atrule' && (parent as postcss.AtRule).name === 'mixin') insideMixin = true; parent = parent.parent; }
      if (insideMixin || /#\{/.test(d.toString())) return;
      const start = d.source!.start!.offset!, end = d.source!.end!.offset!;
      const parents: string[] = []; let p = d.parent;
      while (p && p.type !== 'root') { parents.unshift(p.type === 'rule' ? p.selector : p.type === 'atrule' ? `@${p.name} ${p.params}` : 'container'); p = p.parent; }
      evidence.push(fact(path, original, 'css', `stylesheet/${parents.join('/')}`, d.prop, d.value, start, end, 'scss-css', valueParser(d.value).nodes.map(n => valueParser.stringify(n))));
    });
  } catch { coverage('SCSS source could not be parsed; coverage is incomplete.', 0, original.length); }
  return { evidence, diagnostics };
}

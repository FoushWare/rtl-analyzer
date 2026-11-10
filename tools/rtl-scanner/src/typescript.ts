import ts from "typescript";
import { extractCss } from "./css.js";
import { fact, range, type Evidence, type Diagnostic, type Mechanism } from "./model.js";
export function extractTypescript(path: string, text: string) {
  const sf = ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const evidence: Evidence[] = [], diagnostics: Diagnostic[] = [];
  const imports = new Map<string,string>(); const constants = new Map<string,ts.Expression>(); const ambiguousConstants=new Set<string>();
  function pre(n: ts.Node) {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c=n.importClause;
      if(c?.name) imports.set(c.name.text,n.moduleSpecifier.text);
      if(c?.namedBindings && ts.isNamedImports(c.namedBindings)) for(const e of c.namedBindings.elements) imports.set(e.name.text,`${n.moduleSpecifier.text}:${e.propertyName?.text ?? e.name.text}`);
    }
    if(ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isVariableDeclarationList(n.parent) && (n.parent.flags & ts.NodeFlags.Const)) {if(constants.has(n.name.text))ambiguousConstants.add(n.name.text);else constants.set(n.name.text,n.initializer);}
    ts.forEachChild(n,pre);
  } pre(sf);
  const diag=(n:ts.Node,code:string,message:string)=>diagnostics.push({path,code,message,range:range(text,n.getStart(sf),n.end)});
  const context=(n:ts.Node):string=> { let p:ts.Node|undefined=n; while(p){if(ts.isFunctionDeclaration(p)&&p.name)return p.name.text; if(ts.isVariableDeclaration(p)&&ts.isIdentifier(p.name))return p.name.text; p=p.parent;} return 'module'; };
  const aliases:Record<string,string>={ml:'marginLeft',mr:'marginRight',pl:'paddingLeft',pr:'paddingRight',mx:'marginHorizontalAxis',my:'marginVerticalAxis',px:'paddingHorizontalAxis',py:'paddingVerticalAxis',m:'margin',p:'padding'};
  function object(n: ts.Expression, mechanism: Mechanism, ctx:string, seen=new Set<string>(), inheritedKey?:string) {
    if(ts.isParenthesizedExpression(n)||ts.isAsExpression(n)||ts.isSatisfiesExpression(n)){object(n.expression,mechanism,ctx,seen);return;}
    if(ts.isIdentifier(n)&&constants.has(n.text)&&!ambiguousConstants.has(n.text)&&!seen.has(n.text)){ object(constants.get(n.text)!,mechanism,`${ctx}/reference:${n.text}`,new Set([...seen,n.text]));return; }
    if(ts.isArrayLiteralExpression(n)){n.elements.forEach((e,i)=>object(e,mechanism,`${ctx}/array:${i}`,seen));return;}
    if(ts.isArrowFunction(n)||ts.isFunctionExpression(n)){diag(n,'STYLE_CALLBACK','Callback is inspected structurally, never invoked.');if(ts.isBlock(n.body)){for(const stmt of n.body.statements)if(ts.isReturnStatement(stmt)&&stmt.expression)object(stmt.expression,mechanism,ctx+'/callback',seen);}else object(n.body,mechanism,ctx+'/callback',seen);return;}
    if(!ts.isObjectLiteralExpression(n)){diag(n,'UNRESOLVED_STYLE','Style expression is not a bounded object/literal; not evaluated.');return;}
    for(const p of n.properties){
      if(!ts.isPropertyAssignment(p)||ts.isComputedPropertyName(p.name)){diag(p,'UNRESOLVED_PROPERTY','Spread, shorthand, method or computed style key not resolved.');continue;}
      const key=ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)||ts.isNumericLiteral(p.name)?p.name.text:p.name.getText(sf);
      const v=p.initializer;
      const resolvedKey=inheritedKey??(mechanism==='mui-sx'?aliases[key]??key:key);
      if(ts.isArrayLiteralExpression(v)&&mechanism==='mui-sx'&&key!=='sx'){
        v.elements.forEach((item,i)=>{if(item.kind===ts.SyntaxKind.NullKeyword)return;const literal=ts.isStringLiteral(item)||ts.isNumericLiteral(item)||(ts.isPrefixUnaryExpression(item)&&ts.isNumericLiteral(item.operand));if(!literal)diag(item,'DYNAMIC_VALUE',`Value for ${resolvedKey} is dynamic; original retained.`);evidence.push(fact(path,text,mechanism,`${ctx}/${key}/responsive:${i}`,resolvedKey,item.getText(sf),item.getStart(sf),item.end,/^(margin|padding|gap)/.test(resolvedKey)?'mui-theme-spacing':'mui-system'));});continue;
      }
      if(ts.isObjectLiteralExpression(v)||ts.isArrayLiteralExpression(v)){
        const responsive=mechanism==='mui-sx'&&ts.isObjectLiteralExpression(v)&&v.properties.length>0&&v.properties.every(x=>ts.isPropertyAssignment(x)&&/^(xs|sm|md|lg|xl)$/.test(x.name.getText(sf)));
        object(v,mechanism,`${ctx}/${key}`,seen,responsive?resolvedKey:undefined);continue;
      }
      const literal=ts.isStringLiteral(v)||ts.isNumericLiteral(v)||ts.isNoSubstitutionTemplateLiteral(v)||(ts.isPrefixUnaryExpression(v)&&ts.isNumericLiteral(v.operand));
      if(!literal){diag(v,'DYNAMIC_VALUE',`Value for ${key} is dynamic; original retained.`);}
      const normalized=resolvedKey;
      const spacing=/^(margin|padding|gap|rowGap|columnGap)/.test(normalized)||/(margin|padding|gap)(?:\/|$)/i.test(ctx);
      evidence.push(fact(path,text,mechanism,ctx,normalized,v.getText(sf),p.getStart(sf),p.end,mechanism==='react-inline'?'react-css':mechanism==='mui-theme'?'emotion-css':spacing?'mui-theme-spacing':'mui-system'));
    }
  }
  function visit(n:ts.Node){
    if(ts.isJsxAttribute(n)&&n.initializer&&ts.isJsxExpression(n.initializer)&&n.initializer.expression){
      const key=n.name.getText(sf); const opening=n.parent.parent;
      const tag=ts.isJsxOpeningElement(opening)||ts.isJsxSelfClosingElement(opening)?opening.tagName.getText(sf):'';
      const mui=imports.get(tag)?.startsWith('@mui/')||['FormField','Button'].includes(tag)&&imports.get(tag)?.startsWith('@atlas/design-system');
      if(key==='style')object(n.initializer.expression,'react-inline',`${context(n)}/${tag}`);
      if(key==='sx'){if(mui)object(n.initializer.expression,'mui-sx',`${context(n)}/${tag}`);else diag(n,'UNRESOLVED_SX_OWNER','sx owner not resolved to a known MUI import/wrapper.');}
    }
    if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&imports.get(n.expression.text)?.endsWith(':createTheme')){
      for(const a of n.arguments) if(ts.isObjectLiteralExpression(a)) for(const p of a.properties) if(ts.isPropertyAssignment(p)&&p.name.getText(sf)==='components'&&ts.isObjectLiteralExpression(p.initializer)){
        function overrides(x:ts.Node){if(ts.isPropertyAssignment(x)&&x.name.getText(sf)==='styleOverrides')object(x.initializer,'mui-theme',context(n)+'/styleOverrides');else ts.forEachChild(x,overrides);} overrides(p.initializer);
      }
    }
    if(ts.isTaggedTemplateExpression(n)){
      let tag:ts.Expression=n.tag; while(ts.isPropertyAccessExpression(tag)||ts.isCallExpression(tag))tag=tag.expression;
      if(ts.isIdentifier(tag)&&imports.get(tag.text)==='@emotion/styled'){
        if(ts.isNoSubstitutionTemplateLiteral(n.template)){ const start=n.template.getStart(sf)+1; const raw=text.slice(start,n.template.end-1); if(raw.includes('\\'))diag(n.template,'TEMPLATE_ESCAPE','Escaped template requires cooked/raw mapping; fragment skipped.');else {const r=extractCss(path,text,raw,start,'emotion-template',context(n));evidence.push(...r.evidence);diagnostics.push(...r.diagnostics);} }
        else {diag(n.template,'EMOTION_INTERPOLATION','Interpolated template not evaluated; independent declarations extracted conservatively.'); const chunks=[n.template.head,...n.template.templateSpans.map(s=>s.literal)]; for(const chunk of chunks){const start=chunk.getStart(sf)+1; const end=chunk.end-(chunk.kind===ts.SyntaxKind.TemplateTail?1:2);const raw=text.slice(start,end); if(raw.includes('\\')){diag(chunk,'TEMPLATE_ESCAPE','Escaped interpolated fragment skipped.');continue;} // Only standalone semicolon-terminated declarations; no crossing holes.
          const regex=/(?:^|[;\n])\s*([a-z-]+\s*:[^;{}$]+;)/g; let m; while((m=regex.exec(raw))){const offset=start+m.index+m[0].indexOf(m[1]);const r=extractCss(path,text,m[1],offset,'emotion-template',context(n));evidence.push(...r.evidence);diagnostics.push(...r.diagnostics);}}
        }
      }
    }
    ts.forEachChild(n,visit);
  } visit(sf);
  const parsed=sf as ts.SourceFile & {parseDiagnostics: readonly ts.DiagnosticWithLocation[]};
  for(const d of parsed.parseDiagnostics) diagnostics.push({path,code:'TS_PARSE',message:ts.flattenDiagnosticMessageText(d.messageText,' '),range:range(text,d.start??0,(d.start??0)+(d.length??0))});
  return {evidence,diagnostics};
}

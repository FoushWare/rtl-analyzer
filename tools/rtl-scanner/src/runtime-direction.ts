import ts from 'typescript';

/** Bounded, syntax-only proof. This is not a package, cascade or lifecycle certification. */
export interface CacheProof {
  node: ts.Node;
  supported: boolean;
  reasons: string[];
  themeDirections: ts.PropertyAssignment[];
}
type Direction = 'ltr' | 'rtl';
type Definition = { expression: ts.Expression; declaration: ts.VariableDeclaration };
type Selection<T> = { predicate?: string; yes: T; no: T };
type Cache = { direction: Direction; key: string; declaration: ts.VariableDeclaration };
type Theme = { direction: Direction; property: ts.PropertyAssignment };
const unwrap = (x: ts.Expression): ts.Expression => ts.isParenthesizedExpression(x) ? unwrap(x.expression) : x;
const key = (x: ts.PropertyName): string | undefined => ts.isIdentifier(x) || ts.isStringLiteral(x) ? x.text : undefined;
const signature = (x: ts.Node): string => {
  if (ts.isIdentifier(x) || ts.isStringLiteral(x) || ts.isNumericLiteral(x)) return `${x.kind}:${x.text}`;
  const children: string[] = []; ts.forEachChild(x, n => { children.push(signature(n)); });
  return `${x.kind}(${children.join('|')})`;
};

export function analyzeRuntimeDirection(sf: ts.SourceFile): CacheProof[] {
  const imports = new Map<string, string>();
  const namespaces = new Map<string, string>();
  const ambiguousImports = new Set<string>();
  const register = (name: string, value: string) => { if (imports.has(name)) ambiguousImports.add(name); imports.set(name, value); };
  const declarations = new Map<string, ts.VariableDeclaration[]>();
  const allNodes: ts.Node[] = [];
  function collect(n: ts.Node) {
    allNodes.push(n);
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) ) {
      const c = n.importClause, module = n.moduleSpecifier.text;
      if (c?.name) register(c.name.text, `${module}:${c.isTypeOnly ? 'type:' : ''}default`);
      if (c?.namedBindings && ts.isNamedImports(c.namedBindings)) for (const e of c.namedBindings.elements) {
        register(e.name.text, `${module}:${e.isTypeOnly || c?.isTypeOnly ? 'type:' : ''}${e.propertyName?.text ?? e.name.text}`);
      }
      if (c?.namedBindings && ts.isNamespaceImport(c.namedBindings)) namespaces.set(c.namedBindings.name.text, module);
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) {
      const items = declarations.get(n.name.text) ?? []; items.push(n); declarations.set(n.name.text, items);
    }
    ts.forEachChild(n, collect);
  }
  collect(sf);
  // Record binding identities, including unsupported destructuring, before resolving uses.
  // Unsupported bindings still hide outer definitions; they never authorize a proof.
  const lexical = new Map<ts.Node, Map<string, ts.Node[]>>();
  const lexicalScope = (n: ts.Node): ts.Node => {
    let p = n.parent;
    while (p && !ts.isBlock(p) && !ts.isSourceFile(p) && !ts.isFunctionLike(p) &&
      !ts.isCatchClause(p) && !ts.isForStatement(p) && !ts.isForInStatement(p) && !ts.isForOfStatement(p)) p = p.parent;
    return p ?? sf;
  };
  const record = (owner: ts.Node, name: ts.BindingName, node: ts.Node) => {
    if (ts.isIdentifier(name)) {
      const table = lexical.get(owner) ?? new Map<string, ts.Node[]>();
      table.set(name.text, [...(table.get(name.text) ?? []), node]); lexical.set(owner, table);
    } else for (const element of name.elements) if (ts.isBindingElement(element)) record(owner, element.name, element);
  };
  for (const n of allNodes) {
    if (ts.isVariableDeclaration(n)) {
      let owner = lexicalScope(n);
      if (ts.isVariableDeclarationList(n.parent) && !(n.parent.flags & ts.NodeFlags.BlockScoped)) {
        while (!ts.isFunctionLike(owner) && !ts.isSourceFile(owner)) owner = lexicalScope(owner);
      }
      record(owner, n.name, n);
    } else if (ts.isParameter(n)) record(n.parent, n.name, n);
    else if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) record(lexicalScope(n), n.name, n);
    else if ((ts.isFunctionExpression(n) || ts.isClassExpression(n)) && n.name) record(n, n.name, n);
  }
  const nearest = (x: ts.Identifier): ts.Node | undefined => {
    let p: ts.Node | undefined = x;
    while (p) {
      const matches = lexical.get(p)?.get(x.text);
      if (matches) return matches.length === 1 ? matches[0] : p; // ambiguity blocks outer lookup
      p = p.parent;
    }
    return;
  };
  const isShadowedImport = (x: ts.Identifier) => nearest(x) !== undefined;
  const binding = (x: ts.Node) => ts.isIdentifier(x) && !ambiguousImports.has(x.text) && !isShadowedImport(x) ? imports.get(x.text) : undefined;
  const definition = (x: ts.Identifier): Definition | undefined => {
    const d = nearest(x);
    if (!d || !ts.isVariableDeclaration(d) || !ts.isIdentifier(d.name) || !d.initializer ||
      !ts.isVariableDeclarationList(d.parent) || !(d.parent.flags & ts.NodeFlags.Const)) return;
    return { expression: d.initializer, declaration: d };
  };
  const moduleDefinition = (d: Definition) => ts.isVariableStatement(d.declaration.parent.parent) && ts.isSourceFile(d.declaration.parent.parent.parent);
  const properties = (x: ts.Expression): Map<string, ts.PropertyAssignment> | undefined => {
    if (!ts.isObjectLiteralExpression(x)) return;
    const result = new Map<string, ts.PropertyAssignment>();
    for (const p of x.properties) {
      if (!ts.isPropertyAssignment(p)) return;
      const name = key(p.name); if (!name || result.has(name)) return;
      result.set(name, p);
    }
    return result;
  };
  // Reject mutation/escape of runtime definitions instead of treating const as deep immutability.
  const escaped = (d: Definition) => allNodes.some(n => {
    if (!ts.isIdentifier(n) || definition(n)?.declaration !== d.declaration || n === d.declaration.name) return false;
    let p: ts.Node = n;
    while (ts.isPropertyAccessExpression(p.parent) || ts.isElementAccessExpression(p.parent)) p = p.parent;
    const parent = p.parent;
    return ts.isBinaryExpression(parent) && parent.left === p && parent.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && parent.operatorToken.kind <= ts.SyntaxKind.LastAssignment ||
      (ts.isPostfixUnaryExpression(parent) || ts.isPrefixUnaryExpression(parent) || ts.isDeleteExpression(parent)) ||
      ts.isCallExpression(parent) || ts.isNewExpression(parent) || ts.isReturnStatement(parent) ||
      ts.isPropertyAssignment(parent) || ts.isArrayLiteralExpression(parent) || ts.isVariableDeclaration(parent) || ts.isExportSpecifier(parent);
  });
  const reasons: string[] = [];
  const fail = (reason: string) => { reasons.push(reason); return undefined; };
  function cache(x: ts.Expression): Cache | undefined {
    x = unwrap(x);
    if (!ts.isIdentifier(x)) return fail('Cache must reference a module const created by the directly imported factory.');
    const d = definition(x);
    if (!d || !moduleDefinition(d) || escaped(d) || ts.isVariableStatement(d.declaration.parent.parent) && d.declaration.parent.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) return fail('Cache definition is ambiguous, mutable, escaping or created inside a render/function.');
    const call = d.expression;
    if (!ts.isCallExpression(call) || binding(call.expression) !== '@emotion/cache:default' || call.arguments.length !== 1) return fail('Unknown cache factory or nonliteral cache options.');
    const props = properties(call.arguments[0]);
    if (!props || [...props.keys()].some(k => !['key', 'stylisPlugins'].includes(k))) return fail('Cache options contain unsupported fields, duplicate keys or spreads.');
    const k = props.get('key')?.initializer;
    if (!k || !ts.isStringLiteral(k) || !/^[a-z-]+$/.test(k.text)) return fail('Cache key must be a nonempty literal lowercase/hyphen string.');
    const plugins = props.get('stylisPlugins')?.initializer;
    if (!plugins || !ts.isArrayLiteralExpression(plugins)) return fail('Missing or dynamic plugin array; prefixer must be explicit.');
    const names = plugins.elements.map(p => binding(p));
    if (names[0] !== 'stylis:prefixer') return fail('Missing prefixer or incorrect plugin order.');
    let direction: Direction;
    if (names.length === 1) direction = 'ltr';
    else if (names.length === 2 && names[1] === '@mui/stylis-plugin-rtl:default') direction = 'rtl';
    else return fail('Missing/unknown/dynamic/duplicate RTL processor or unsupported plugin order.');
    return { direction, key: k.text, declaration: d.declaration };
  }
  function theme(x: ts.Expression): Theme | undefined {
    x = unwrap(x);
    if (!ts.isIdentifier(x)) return fail('Theme must reference a module const with explicit literal direction.');
    const d = definition(x);
    if (!d || !moduleDefinition(d) || escaped(d)) return fail('Theme definition is ambiguous, mutable, escaping or render-local.');
    const call = d.expression;
    if (!ts.isCallExpression(call) || !['@mui/material:createTheme', '@mui/material/styles:createTheme'].includes(binding(call.expression) ?? '') || call.arguments.length !== 1) return fail('Unsupported theme factory/options.');
    const props = properties(call.arguments[0]), p = props?.get('direction');
    if (!p || !ts.isStringLiteral(p.initializer) || !['ltr', 'rtl'].includes(p.initializer.text)) return fail('Theme direction is not an explicit supported literal.');
    return { direction: p.initializer.text as Direction, property: p };
  }
  function selection<T>(x: ts.Expression, leaf: (n: ts.Expression) => T | undefined, seen = new Set<ts.Node>()): Selection<T> | undefined {
    x = unwrap(x);
    if (ts.isIdentifier(x)) {
      const d = definition(x);
      if (d && ts.isConditionalExpression(unwrap(d.expression))) {
        if (seen.has(d.declaration) || escaped(d)) return fail('Cyclic or escaping selection alias.');
        return selection(d.expression, leaf, new Set([...seen, d.declaration]));
      }
    }
    if (ts.isConditionalExpression(x)) {
      // Only side-effect-free comparison predicates. Opaque identifiers/calls are not proven selectors.
      const c = unwrap(x.condition);
      if (!ts.isBinaryExpression(c) || c.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
        !ts.isIdentifier(c.left) || !ts.isStringLiteral(c.right) || !['rtl', 'ar'].includes(c.right.text)) return fail('Unsupported direction predicate.');
      const yes = leaf(x.whenTrue), no = leaf(x.whenFalse);
      return yes && no ? { predicate: signature(c), yes, no } : undefined;
    }
    const value = leaf(x); return value !== undefined ? { yes: value, no: value } : undefined;
  }
  const attribute = (n: ts.JsxOpeningLikeElement, name: string): ts.Expression | undefined => {
    if (n.attributes.properties.some(p => ts.isJsxSpreadAttribute(p))) return;
    const attrs = n.attributes.properties.filter(p => ts.isJsxAttribute(p) && p.name.getText(sf) === name);
    const a = attrs[0];
    return attrs.length === 1 && ts.isJsxAttribute(a) && a.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : undefined;
  };
  const importedTag = (n: ts.JsxOpeningLikeElement, role: string): boolean => {
    const name = n.tagName.getText(sf);
    if (imports.get(name)?.endsWith(`:${role}`)) return true;
    if (ts.isPropertyAccessExpression(n.tagName) && ts.isIdentifier(n.tagName.expression) &&
      namespaces.has(n.tagName.expression.text) && n.tagName.name.text === role) return true;
    // Local aliases and named re-exports remain visible, but are never accepted as direct bindings.
    const d = ts.isIdentifier(n.tagName) ? definition(n.tagName) : undefined;
    return !!d && ts.isIdentifier(d.expression) && imports.get(d.expression.text)?.endsWith(`:${role}`) === true;
  };
  const openings = allNodes.filter((n): n is ts.JsxOpeningLikeElement => ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n));
  const cacheNodes = openings.filter(n => importedTag(n, 'CacheProvider') || n.tagName.getText(sf) === 'CacheProvider');
  const proofs: CacheProof[] = [];
  for (const node of cacheNodes) {
    reasons.length = 0;
    if (binding(node.tagName) !== '@emotion/react:CacheProvider') fail('Unresolved CacheProvider alias, namespace, wrapper or re-export.');
    const value = attribute(node, 'value');
    const cs = value ? selection(value, cache) : fail('CacheProvider value missing, duplicated or spread.');
    // Require exactly one directly nested ThemeProvider, not an untraced wrapper.
    const parent = node.parent;
    const children = ts.isJsxElement(parent) && parent.openingElement === node ? parent.children.filter(n => !ts.isJsxText(n) || n.getText(sf).trim()) : [];
    const nested = children.length === 1 && ts.isJsxElement(children[0]) ? children[0].openingElement : undefined;
    if (!nested || !['@mui/material:ThemeProvider', '@mui/material/styles:ThemeProvider'].includes(binding(nested.tagName) ?? '')) fail('A single direct ThemeProvider child is required; wrapper topology is unresolved.');
    const tv = nested && attribute(nested, 'theme');
    const th = tv ? selection(tv, theme) : fail('Theme selection is missing or unsupported.');
    if (cs && th && (cs.predicate !== th.predicate || cs.yes.direction !== th.yes.direction || cs.no.direction !== th.no.direction)) fail('Theme/cache direction selection mismatch.');
    if (cs) {
      if (cs.predicate && (cs.yes.direction !== 'rtl' || cs.no.direction !== 'ltr')) fail('RTL/Arabic predicate branches must select RTL then LTR.');
      const definitions = new Map<ts.VariableDeclaration, string>();
      // All recognizable module caches share one document namespace, including unused definitions.
      for (const list of declarations.values()) for (const d of list) if (d.initializer && ts.isCallExpression(d.initializer) && binding(d.initializer.expression) === '@emotion/cache:default') {
        const p = d.initializer.arguments[0] && properties(d.initializer.arguments[0]); const k = p?.get('key')?.initializer;
        if (k && ts.isStringLiteral(k)) definitions.set(d, k.text);
      }
      if (new Set(definitions.values()).size !== definitions.size) fail('Duplicate cache keys in analyzed file.');
      if (cs.yes.direction !== cs.no.direction && cs.yes.key === cs.no.key) fail('LTR and RTL caches require distinct keys.');
      const docs = allNodes.filter((n): n is ts.BinaryExpression => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText(sf) === 'document.documentElement.dir');
      const ds = docs.map(n => selection(n.right, x => ts.isStringLiteral(x) && ['ltr', 'rtl'].includes(x.text) ? x.text as Direction : undefined));
      if (!ds.length || ds.some(d => !d || d.predicate !== cs.predicate || d.yes !== cs.yes.direction || d.no !== cs.no.direction)) fail('Document/theme/cache selection cannot be correlated within this source file.');
    }
    // Predicate identifiers must bind to the same lexical declaration across selectors.
    if (cs?.predicate) {
      const conditions: ts.Identifier[] = [];
      for (const x of [value, tv, ...allNodes.filter((n): n is ts.BinaryExpression => ts.isBinaryExpression(n) && n.left.getText(sf) === 'document.documentElement.dir').map(n => n.right)]) {
        if (!x) continue;
        let e = unwrap(x); if (ts.isIdentifier(e)) { const d = definition(e); if (d) e = unwrap(d.expression); }
        if (ts.isConditionalExpression(e) && ts.isBinaryExpression(e.condition) && ts.isIdentifier(e.condition.left)) conditions.push(e.condition.left);
      }
      function predicateBinding(n: ts.Identifier): ts.Node | undefined {
        const resolved = nearest(n);
        if (!resolved) return;
        if (ts.isVariableDeclaration(resolved)) return definition(n)?.declaration;
        if (ts.isParameter(resolved)) return ts.isIdentifier(resolved.name) && !resolved.initializer && !resolved.dotDotDotToken ? resolved : undefined;
        if (!ts.isBindingElement(resolved) || resolved.initializer || resolved.dotDotDotToken || !ts.isObjectBindingPattern(resolved.parent)) return;
        // Keep the existing flat immutable object-selector grammar; nested/rest/array
        // bindings hide outer selectors but remain unsupported for correlation.
        const owner = resolved.parent.parent;
        if (ts.isParameter(owner)) return !owner.initializer && !owner.dotDotDotToken ? resolved : undefined;
        if (ts.isVariableDeclaration(owner) && ts.isVariableDeclarationList(owner.parent) && owner.parent.flags & ts.NodeFlags.Const) return resolved;
        return;
      }
      const declarationsFor = conditions.map(predicateBinding);
      if (!conditions.length || declarationsFor.some(d => !d) || new Set(declarationsFor).size !== 1) fail('Direction predicate binding is unresolved or differs between selectors.');
      if (conditions.some(n => allNodes.some(x => ts.isBinaryExpression(x) && x.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && x.operatorToken.kind <= ts.SyntaxKind.LastAssignment && ts.isIdentifier(x.left) && nearest(x.left) === predicateBinding(n) || (ts.isPostfixUnaryExpression(x) || ts.isPrefixUnaryExpression(x)) && ts.isIdentifier(x.operand) && nearest(x.operand) === predicateBinding(n)))) fail('Direction predicate is reassigned; sequencing is unsupported.');
    }
    proofs.push({ node, supported: reasons.length === 0, reasons: [...new Set(reasons)], themeDirections: reasons.length === 0 && th ? [...new Set([th.yes.property, th.no.property])] : [] });
  }
  // A proved subtree cannot excuse another untraced ThemeProvider in the same file.
  const nestedThemes = new Set<ts.JsxOpeningLikeElement | undefined>(proofs.map(p => {
    const parent = p.node.parent;
    return ts.isJsxElement(parent) ? parent.children.find(ts.isJsxElement)?.openingElement : undefined;
  }));
  const extraThemes = openings.some(n => importedTag(n, 'ThemeProvider') && !nestedThemes.has(n));
  if (extraThemes) for (const p of proofs) { p.supported = false; p.themeDirections = []; p.reasons.push('Additional ThemeProvider topology remains unresolved.'); }
  if (proofs.length && proofs.every(p => p.supported)) {
    // Ignore genuinely unused, unexported literal themes; do not claim imported consumers unreachable.
    for (const list of declarations.values()) for (const declaration of list) {
      const expression = declaration.initializer;
      if (!expression || !ts.isCallExpression(expression) || !['@mui/material:createTheme', '@mui/material/styles:createTheme'].includes(binding(expression.expression) ?? '')) continue;
      if (!ts.isVariableStatement(declaration.parent.parent) || declaration.parent.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
      const refs = allNodes.filter(n => ts.isIdentifier(n) && n !== declaration.name && definition(n)?.declaration === declaration);
      const property = expression.arguments[0] && properties(expression.arguments[0])?.get('direction');
      if (!refs.length && property && ts.isStringLiteral(property.initializer)) proofs[0].themeDirections.push(property);
    }
  }
  for (const [name, source] of imports) if (source.endsWith(':CacheProvider')) {
    const uses = allNodes.filter(n => ts.isIdentifier(n) && n.text === name && binding(n) === source && !ts.isImportSpecifier(n.parent) && !ts.isJsxClosingElement(n.parent));
    const untraced = uses.find(n => !proofs.some(p => p.node === n.parent) && !ts.isImportClause(n.parent));
    if (untraced || !cacheNodes.length) {
      const node = untraced ?? allNodes.find(n => ts.isImportSpecifier(n) && n.name.text === name)!;
      proofs.push({node, supported:false, reasons:['CacheProvider binding escapes into an unresolved alias/wrapper or has no traceable JSX use.'], themeDirections:[]});
      for (const p of proofs) p.themeDirections = [];
    }
  }
  return proofs;
}

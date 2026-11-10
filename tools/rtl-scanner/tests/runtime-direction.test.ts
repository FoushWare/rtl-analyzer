import { it, expect } from 'vitest';
import ts from 'typescript';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyzeRuntimeDirection } from '../src/runtime-direction.js';
import { detect } from '../src/rules.js';
import { emptyPolicy } from '../src/policy.js';
import { scan } from '../src/scan.js';
import { json, markdown } from '../src/report.js';
import { exitCode } from '../src/coverage.js';
const paired = await readFile('tools/rtl-scanner/tests/fixtures/runtime/paired.tsx', 'utf8');
const literal = (direction: 'ltr' | 'rtl') => paired.replace('direction === \'rtl\' ? \'rtl\' : \'ltr\'', `'${direction}'`)
  .replace('direction === \'rtl\' ? rtlCache : ltrCache', `${direction}Cache`)
  .replace('direction === \'rtl\' ? rtlTheme : ltrTheme', `${direction}Theme`);
function run(source: string) {
  const sf = ts.createSourceFile('fixture.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diagnostics: Parameters<typeof detect>[3] = [];
  const findings = detect([], new Map([['fixture.tsx', source]]), emptyPolicy, diagnostics);
  return { proofs: analyzeRuntimeDirection(sf), findings, diagnostics };
}
it('literal LTR cache is supported with explicit prefixer, theme and document', () => {
  const r = run(literal('ltr')); expect(r.proofs[0].supported).toBe(true); expect(r.diagnostics).toEqual([]);
});
it('literal RTL cache is supported with prefixer then the direct RTL plugin', () => {
  const r = run(literal('rtl')); expect(r.proofs[0].supported).toBe(true); expect(r.diagnostics).toEqual([]);
  expect(r.findings.some(f => f.ruleId === 'RTL.RUNTIME.MISMATCH')).toBe(false);
});
it('paired cache/theme/document selectors preserve the unused LTR theme', () => {
  const r = run(paired); expect(r.proofs[0].supported, r.proofs[0].reasons.join(' ')).toBe(true);
  expect(r.diagnostics).toEqual([]); expect(r.findings.some(f => /CACHE|MISMATCH/.test(f.ruleId))).toBe(false);
});
it('local immutable ternary selector aliases are supported', () => {
  const s = paired.replace('  return <CacheProvider', "  const cache = direction === 'rtl' ? rtlCache : ltrCache;\n  const theme = direction === 'rtl' ? rtlTheme : ltrTheme;\n  return <CacheProvider")
    .replace("value={direction === 'rtl' ? rtlCache : ltrCache}", 'value={cache}').replace("theme={direction === 'rtl' ? rtlTheme : ltrTheme}", 'theme={theme}');
  expect(run(s).proofs[0].supported).toBe(true);
});
it('named import aliases retain their verified bindings', () => {
  const s = paired.replace('{ CacheProvider }', '{ CacheProvider as CP }').replaceAll('CacheProvider value', 'CP value').replace('</CacheProvider>', '</CP>');
  expect(run(s).proofs[0].supported).toBe(true);
});
const negatives: [string, (s: string) => string, string][] = [
  ['missing prefixer', s => s.replace('[prefixer, rtlPlugin]', '[rtlPlugin]'), 'prefixer'],
  ['missing RTL processor', s => s.replace('[prefixer, rtlPlugin]', '[prefixer]'), 'mismatch'],
  ['reversed order', s => s.replace('[prefixer, rtlPlugin]', '[rtlPlugin, prefixer]'), 'order'],
  ['duplicate processor', s => s.replace('[prefixer, rtlPlugin]', '[prefixer, rtlPlugin, rtlPlugin]'), 'duplicate'],
  ['duplicate keys', s => s.replace("key: 'atlas-rtl'", "key: 'css'"), 'Duplicate'],
  ['dynamic plugins', s => s.replace('[prefixer, rtlPlugin]', 'plugins'), 'dynamic'],
  ['unknown plugin', s => s.replace('[prefixer, rtlPlugin]', '[prefixer, mystery]'), 'unknown'],
  ['array spread', s => s.replace('[prefixer, rtlPlugin]', '[prefixer, ...plugins]'), 'dynamic'],
  ['unknown factory', s => s.replace('const rtlCache = createCache', 'const rtlCache = factory'), 'factory'],
  ['unsupported options', s => s.replace("key: 'atlas-rtl'", "prepend: true, key: 'atlas-rtl'"), 'unsupported'],
  ['spread options', s => s.replace("key: 'atlas-rtl'", "...options, key: 'atlas-rtl'"), 'unsupported'],
  ['missing explicit plugin array', s => s.replace(', stylisPlugins: [prefixer, rtlPlugin]', ''), 'prefixer'],
  ['invalid key', s => s.replace("key: 'atlas-rtl'", "key: 'RTL2'"), 'key'],
  ['theme/cache mismatch', s => s.replace("theme={direction === 'rtl' ? rtlTheme : ltrTheme}", "theme={direction === 'rtl' ? ltrTheme : rtlTheme}"), 'mismatch'],
  ['unresolved wrapper child', s => s.replace('<ThemeProvider theme=', '<Wrapper theme=').replace('</ThemeProvider>', '</Wrapper>'), 'wrapper'],
  ['foreign reexport', s => s.replace("from '@emotion/react'", "from './wrapper'"), 're-export'],
  ['namespace provider', s => s.replace("import { CacheProvider } from '@emotion/react';", "import * as emotion from '@emotion/react';").replaceAll('<CacheProvider', '<emotion.CacheProvider').replace('</CacheProvider>', '</emotion.CacheProvider>'), 'namespace'],
  ['local provider alias', s => s.replace('export function Runtime', 'const CP = CacheProvider;\nexport function Runtime').replaceAll('<CacheProvider', '<CP').replace('</CacheProvider>', '</CP>'), 'alias'],
  ['unknown document selector', s => s.replace("document.documentElement.dir = direction === 'rtl' ? 'rtl' : 'ltr';", 'document.documentElement.dir = getDirection();'), 'correlated'],
  ['different selector predicate', s => s.replace("theme={direction === 'rtl'", "theme={language === 'ar'"), 'mismatch'],
  ['mutated cache', s => s.replace('export function Runtime', "rtlCache.key = 'other';\nexport function Runtime"), 'mutable'],
  ['escaped cache', s => s.replace('export function Runtime', 'unknown(rtlCache);\nexport function Runtime'), 'escaping'],
  ['alias escape', s => s.replace('export function Runtime', "const leaked = rtlCache;\nleaked.key = 'other';\nexport function Runtime"), 'escaping'],
  ['predicate reassignment', s => s.replace('  return <CacheProvider', "  direction = 'rtl';\n  return <CacheProvider"), 'reassigned'],
  ['mutable declaration', s => s.replace('const rtlCache', 'let rtlCache'), 'mutable'],
  ['render-local cache', s => s.replace("const rtlCache = createCache({ key: 'atlas-rtl', stylisPlugins: [prefixer, rtlPlugin] });", '').replace("  return <CacheProvider", "  const rtlCache = createCache({ key: 'atlas-rtl', stylisPlugins: [prefixer, rtlPlugin] });\n  return <CacheProvider"), 'render'],
  ['spread JSX props', s => s.replace('<CacheProvider value=', '<CacheProvider {...props} value='), 'spread'],
  ['additional theme consumer', s => s + '\n<ThemeProvider theme={ltrTheme}><div /></ThemeProvider>;', 'topology'],
];
for (const [name, change, reason] of negatives) it(`${name} stays blocking and source-located`, () => {
  const source = change(paired), r = run(source);
  expect(r.proofs.length).toBeGreaterThan(0); expect(r.proofs.every(p => !p.supported)).toBe(true);
  expect(r.proofs.flatMap(p => p.reasons).join(' ').toLowerCase()).toContain(reason.toLowerCase());
  const d = r.diagnostics.find(d => d.code === 'CACHE_CONFIGURATION_UNRESOLVED' && d.range.start.offset===r.proofs[0].node.getStart());
  expect(d?.blocking).toBe(true); expect(d?.impact).toBe('DIRECTIONAL_UNSUPPORTED');
  expect(source.slice(d!.range.start.offset, d!.range.end.offset)).toBe(r.proofs[0].node.getText());
  expect(exitCode(false, r.findings.length, true)).toBe(2);
});
it('unresolved cache is blocking even in LTR-only source', () => {
  expect(run("import {CacheProvider} from '@emotion/react';<CacheProvider value={unknown}/>;").diagnostics.some(d => d.blocking)).toBe(true);
});
it('configuration analysis is deterministic and formatting insensitive', () => {
  expect(run(paired)).toEqual(run(paired));
  expect(run(paired.replaceAll("direction === 'rtl'", "direction /* comment */ === 'rtl'")).proofs[0].supported).toBe(true);
});
it('temporary Nx scan accepts supported configuration but fails closed for a missing RTL processor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-runtime-scanner-'));
  try {
    await mkdir(join(root, 'apps/x/src'), { recursive: true }); await mkdir(join(root, 'libs'));
    await writeFile(join(root, 'apps/x/project.json'), '{"sourceRoot":"apps/x/src"}');
    await writeFile(join(root, 'apps/x/index.html'), '<html dir="ltr"></html>');
    const p = join(root, 'apps/x/src/runtime.tsx'); await writeFile(p, paired);
    const a = await scan(root), b = await scan(root); expect(a.complete).toBe(true);
    expect(json(a)).toBe(json(b)); expect(markdown(a)).toBe(markdown(b)); expect(await readFile(p, 'utf8')).toBe(paired);
    await writeFile(p, paired.replace('[prefixer, rtlPlugin]', '[prefixer]'));
    const c = await scan(root); expect(c.complete).toBe(false); expect(exitCode(c.complete, c.findings.length, true)).toBe(2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('untraced imported provider factory does not hide behind a wrapper name', () => {
 const r = run("import {CacheProvider} from '@emotion/react';const Wrapped=wrap(CacheProvider);document.documentElement.dir='rtl';<Wrapped/>;");
 expect(r.diagnostics.some(d=>d.code==='CACHE_CONFIGURATION_UNRESOLVED'&&d.blocking)).toBe(true);
});
it('cross-file configuration is explicitly unsupported instead of silently correlated', () => {
 const r = run(paired.replace(/document.documentElement.dir = [^;]+;/, ''));
 expect(r.proofs[0].supported).toBe(false);expect(r.diagnostics.some(d=>d.blocking)).toBe(true);
});
it('type-only provider bindings cannot prove a runtime pipeline', () => {
 const r = run(paired.replace('import { CacheProvider }', 'import type { CacheProvider }'));
 expect(r.proofs[0].supported).toBe(false);expect(r.diagnostics.some(d=>d.blocking)).toBe(true);
});

it('duplicate factory import bindings remain unresolved', () => {
 const r = run(paired.replace("import createCache from '@emotion/cache';", "import createCache from '@emotion/cache';import createCache from '@emotion/cache';"));
 expect(r.proofs[0].supported).toBe(false);expect(r.diagnostics.some(d=>d.blocking)).toBe(true);
});
it('exported cache constants cannot imply a closed ownership graph', () => {
 const r=run(paired.replace('const rtlCache', 'export const rtlCache'));
 expect(r.proofs[0].supported).toBe(false);expect(r.diagnostics.some(d=>d.blocking)).toBe(true);
});
it('distinct lexical direction parameters are not correlated by spelling', () => {
 const r=run(paired.replace("  document.documentElement.dir = direction === 'rtl' ? 'rtl' : 'ltr';", "  function other(direction: string) { document.documentElement.dir = direction === 'rtl' ? 'rtl' : 'ltr'; }"));
 expect(r.proofs[0].supported).toBe(false);expect(r.diagnostics.some(d=>d.blocking)).toBe(true);
});

it('a single immutable destructured locale binding can drive all same-file selectors', () => {
 const source=paired.replace('export function Runtime({ direction }: { direction: string }) {', 'export function Runtime() { const { direction } = useLocale();');
 expect(run(source).proofs[0].supported).toBe(true);
});

it('destructured cache parameter shadowing fails closed', () => {
  const source = paired.replace('Runtime({ direction }: { direction: string })', 'Runtime({ direction, rtlCache }: { direction: string; rtlCache: unknown })');
  const r = run(source);
  expect(r.proofs[0].supported).toBe(false);
  expect(r.proofs[0].reasons.join(' ')).toMatch(/cache.*(shadow|unresolved|ambiguous)/i);
  expect(r.proofs[0].themeDirections).toEqual([]);
  expect(r.diagnostics.some(d => d.code === 'CACHE_CONFIGURATION_UNRESOLVED' && d.blocking)).toBe(true);
  expect(exitCode(!r.diagnostics.some(d => d.blocking), r.findings.length, false)).toBe(2);
});

const shadowingCases: [string, (s: string) => string][] = [
  ['renamed object cache binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime({ direction, cache: rtlCache })')],
  ['nested object cache binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime({ direction, nested: { rtlCache } })')],
  ['array cache binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime(direction, [rtlCache])')],
  ['object theme binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime({ direction, rtlTheme })')],
  ['local destructured cache declaration', s => s.replace('  return <CacheProvider', '  const { rtlCache } = props;\n  return <CacheProvider')],
  ['nested local theme declaration', s => s.replace('  return <CacheProvider', '  const { nested: { rtlTheme } } = props;\n  return <CacheProvider')],
  ['destructured factory binding', s => s.replace("import createCache from '@emotion/cache';", "import createCache from '@emotion/cache';const { createCache } = unknown;")],
  ['simple factory binding', s => s.replace("import createCache from '@emotion/cache';", "import createCache from '@emotion/cache';const createCache = unknown;")],
  ['nested RTL plugin binding', s => s.replace('const ltrCache', 'const { nested: { rtlPlugin } } = unknown;\nconst ltrCache')],
  ['array prefixer binding', s => s.replace('const ltrCache', 'const [prefixer] = unknown;\nconst ltrCache')],
  ['rest cache binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime({ direction, ...rtlCache })')],
  ['defaulted cache binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime({ direction, rtlCache = unknown })')],
  ['rest direction binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime({ ...direction })')],
  ['nested direction binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime({ nested: { direction } })')],
  ['array direction binding', s => s.replace('Runtime({ direction }: { direction: string })', 'Runtime([direction])')],
  ['defaulted direction binding', s => s.replace('Runtime({ direction }: { direction: string })', "Runtime({ direction = 'rtl' })")],
  ['local provider binding', s => s.replace('  return <CacheProvider', '  const { CacheProvider } = props;\n  return <CacheProvider')],
];
for (const [name, change] of shadowingCases) it(`${name} stays unresolved and blocking`, () => {
  const r = run(change(paired));
  expect(r.proofs.length).toBeGreaterThan(0);
  expect(r.proofs.every(p => !p.supported && p.themeDirections.length === 0)).toBe(true);
  expect(r.diagnostics.some(d => d.code === 'CACHE_CONFIGURATION_UNRESOLVED' && d.blocking)).toBe(true);
});
it('sibling parameter and variable bindings do not shadow verified runtime definitions or imports', () => {
  const source = paired + '\nfunction sibling({ rtlCache, rtlTheme, createCache, prefixer, rtlPlugin }) { const { direction } = props; direction = "ltr"; }';
  expect(run(source).proofs[0].supported).toBe(true);
});
it('nested sibling array bindings do not shadow verified factories', () => {
  expect(run(paired + '\nfunction sibling([createCache, [rtlPlugin, prefixer]]) {}').proofs[0].supported).toBe(true);
});
it('destructured shadowing makes a full temporary Nx scan incomplete', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-shadowing-scanner-'));
  try {
    await mkdir(join(root, 'apps/x/src'), { recursive: true }); await mkdir(join(root, 'libs'));
    await writeFile(join(root, 'apps/x/project.json'), '{"sourceRoot":"apps/x/src"}');
    await writeFile(join(root, 'apps/x/index.html'), '<html dir="ltr"></html>');
    const source = paired.replace('Runtime({ direction }: { direction: string })', 'Runtime({ direction, rtlCache })');
    await writeFile(join(root, 'apps/x/src/runtime.tsx'), source);
    const a = await scan(root), b = await scan(root);
    expect(a.complete).toBe(false);
    expect(a.diagnostics.some(d => d.code === 'CACHE_CONFIGURATION_UNRESOLVED' && d.blocking)).toBe(true);
    expect(exitCode(a.complete, a.findings.length, false)).toBe(2);
    expect(json(a)).toBe(json(b)); expect(markdown(a)).toBe(markdown(b));
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('renamed selected-cache parameter hides the renamed verified module cache', () => {
  const source = paired.replaceAll('rtlCache', 'selectedCache').replace('Runtime({ direction }: { direction: string })', 'Runtime({ direction, rtlCache: selectedCache })');
  const r = run(source);
  expect(r.proofs[0].supported).toBe(false);
  expect(r.diagnostics.some(d => d.code === 'CACHE_CONFIGURATION_UNRESOLVED' && d.blocking)).toBe(true);
});
it('sibling provider binding is not an escape of the imported provider', () => {
  expect(run(paired + '\nfunction sibling({ CacheProvider }) { return CacheProvider; }').proofs.every(p => p.supported)).toBe(true);
});

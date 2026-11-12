import { describe, expect, it as vitestIt } from 'vitest';
import { constants } from 'node:fs';
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Finding } from '../src/model.js';

const posixOnlyTests = new Set([
  'reads verified source, preserves Unicode code-unit offsets, and extracts five-line context',
  'preserves unavailable findings for invalid ranges and changed source',
  'handles CRLF, CR, Unicode, multiline ranges, and deterministic ordering',
  'accounts for exact UTF-8 bytes and preserves CRLF separators at boundaries',
  'does not claim full snapshot identity when unrelated same-size content changes',
  'rejects scanner-inconsistent line and column metadata',
  'keeps empty sources explicit and does not expose source text in failures',
  'uses code-unit ordering for non-ASCII paths and preserves all findings',
]);

const it = (name: string, fn: (...args: any[]) => unknown) => process.platform === 'win32' && posixOnlyTests.has(name)
  ? vitestIt.skip(`${name} (POSIX secure source read; Windows fail-closed contract covered separately)`, fn)
  : vitestIt(name, fn);
import { range } from '../src/model.js';
import { extractSourceSnippets } from '../src/source-snippets.js';

const finding = (path: string, source: string, start: number, end = start + 1, id = path): Finding => ({ id, ruleId: 'R1', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'fixture', sourceMechanism: 'css', applications: [], path, range: range(source, start, end), original: source.slice(start, end), context: 'fixture', ownership: 'fixture', rationale: 'fixture', treatment: 'review', evidenceIds: [], relatedLocations: [], issueIds: [], suggestion: null, limitation: 'fixture' });
async function temp() { return mkdtemp(join(tmpdir(), 'rtl-snippets-')); }

describe('secure source snippets', () => {
  it('reads verified source, preserves Unicode code-unit offsets, and extracts five-line context', async () => {
    const root = await temp(); const source = ['zero', 'one', '😀 margin-left: 1px;', 'three', 'four', 'five', 'six', 'seven', 'eight'].join('\r\n');
    try { await writeFile(join(root, 'a.css'), source); const start = source.indexOf('margin-left'); const result = await extractSourceSnippets(root, [finding('a.css', source, start, start + 10)]); expect(result.findings[0]?.reason).toBeUndefined(); expect(result.findings[0]).toMatchObject({ available: true, startLine: 1, endLine: 8 }); expect(result.sources[0].lines.find(x => x.highlighted)?.text).toContain('margin-left'); }
    finally { await rm(root, { recursive: true, force: true }); }
  });
  it('rejects absolute, traversal, Windows and UNC paths without reading', async () => {
    const root = await temp(); const f = finding('a.css', 'x', 0); try { const paths = ['/etc/passwd', '../a.css', 'C:/a.css', '\\\\server\\a.css']; const out = await extractSourceSnippets(root, paths.map(path => ({ ...f, id: path, path }))); expect(out.findings.map(x => x.reason)).toEqual(paths.map(() => 'INVALID_PATH')); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('rejects symlinked ancestors/files, missing files, and directories', async ({ skip }) => {
    const root = await temp(); const outside = await temp();
    try {
      await writeFile(join(outside, 'x.css'), 'x');
      let symlinkFixture = true;
      try {
        await symlink(join(outside, 'x.css'), join(root, 'file.css'));
        await symlink(outside, join(root, 'linked'));
      } catch (error) {
        if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') symlinkFixture = false;
        else throw error;
      }
      await mkdir(join(root, 'dir'));
      const base = finding('file.css', 'x', 0);
      if (symlinkFixture) {
        const out = await extractSourceSnippets(root, [base, { ...base, id: 'ancestor', path: 'linked/x.css' }, { ...base, id: 'missing', path: 'missing.css' }, { ...base, id: 'dir', path: 'dir' }]);
        expect(out.findings.map(x => x.reason)).toEqual(['NON_REGULAR_FILE', 'SYMLINK', 'SYMLINK', 'MISSING_FILE']);
      } else {
        const out = await extractSourceSnippets(root, [{ ...base, id: 'missing', path: 'missing.css' }, { ...base, id: 'dir', path: 'dir' }]);
        expect(out.findings.map(x => x.reason)).toEqual(['NON_REGULAR_FILE', 'MISSING_FILE']);
        skip('Windows symlink fixtures require privileges unavailable in this environment');
      }
    } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
  });
  it('preserves unavailable findings for invalid ranges and changed source', async () => {
    const root = await temp(); try { await writeFile(join(root, 'a.css'), 'actual!!'); const changed = finding('a.css', 'expected', 0, 8, 'changed'); const invalid = { ...changed, id: 'invalid', range: { start: { offset: -1, line: 1, column: 1 }, end: { offset: 0, line: 1, column: 1 } } }; const out = await extractSourceSnippets(root, [changed, invalid]); expect(out.findings).toEqual([{ findingId: 'invalid', available: false, reason: 'INVALID_RANGE' }, { findingId: 'changed', available: false, reason: 'SOURCE_CHANGED' }]); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('handles CRLF, CR, Unicode, multiline ranges, and deterministic ordering', async () => {
    const root = await temp(); const a = 'α\rβ\n😀\ngamma'; const b = 'b\nleft'; try { await writeFile(join(root, 'b.css'), b); await writeFile(join(root, 'a.css'), a); const fa = finding('a.css', a, a.indexOf('😀'), a.length, 'a'); const fb = finding('b.css', b, b.indexOf('left'), b.length, 'b'); const one = await extractSourceSnippets(root, [fb, fa]); const two = await extractSourceSnippets(root, [fa, fb]); expect(one).toEqual(two); expect(one.sources[0].lines.filter(x => x.highlighted).length).toBe(2); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('enforces line/byte and total caps without truncating highlighted ranges', async () => {
    const root = await temp(); const source = Array.from({ length: 12 }, (_, i) => `line-${i}-xxxxxxxx`).join('\n'); try { await writeFile(join(root, 'a.css'), source); await writeFile(join(root, 'b.css'), source); const fa = finding('a.css', source, source.indexOf('line-5'), source.indexOf('line-9'), 'a'); const fb = finding('b.css', source, source.indexOf('line-5'), source.indexOf('line-6'), 'b'); const limited = await extractSourceSnippets(root, [fa], { contextLines: 5, maxLines: 3 }); expect(limited.findings[0].available).toBe(false); const total = await extractSourceSnippets(root, [fb], { totalBytes: 1 }); expect(total.findings.filter(x => x.available)).toHaveLength(0); expect(total.findings).toHaveLength(1); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('rejects scanner-inconsistent line and column metadata', async () => {
    const root = await temp(); const source = '😀\r\nmargin-left'; try { await writeFile(join(root, 'a.css'), source); const valid = finding('a.css', source, source.indexOf('margin-left')); const invalid = { ...valid, id: 'bad-position', range: { ...valid.range, start: { ...valid.range.start, column: valid.range.start.column + 1 } } }; const out = await extractSourceSnippets(root, [invalid]); expect(out.findings).toEqual([{ findingId: 'bad-position', available: false, reason: 'POSITION_MISMATCH' }]); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('accounts for exact UTF-8 bytes and preserves CRLF separators at boundaries', async () => {
    const root = await temp(); const under = 'x'.repeat(10); const over = 'x'.repeat(16385); const source = `${under}\r\nnext`; try { await writeFile(join(root, 'under.css'), source); await writeFile(join(root, 'over.css'), `${over}\r\nnext`); const a = await extractSourceSnippets(root, [finding('under.css', source, 0, source.length, 'under')], { contextLines: 1, maxBytes: 16 }); const b = await extractSourceSnippets(root, [finding('under.css', source, 0, source.length, 'under-low')], { contextLines: 1, maxBytes: 15 }); const c = await extractSourceSnippets(root, [finding('over.css', `${over}\r\nnext`, 0, over.length, 'over')], { contextLines: 0 }); expect(a.findings[0]?.available).toBe(true); expect(a.embeddedBytes).toBe(Buffer.byteLength(source, 'utf8')); expect(b.findings[0]?.reason).toBe('HIGHLIGHT_TOO_LARGE'); expect(c.findings[0]?.reason).toBe('HIGHLIGHT_TOO_LARGE'); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('keeps empty sources explicit and does not expose source text in failures', async () => {
    const root = await temp(); const secret = 'PRIVATE-SOURCE-CONTENT'; try { await writeFile(join(root, 'empty.css'), ''); await writeFile(join(root, 'secret.css'), secret); const empty = finding('empty.css', '', 0, 0, 'empty'); const changed = finding('secret.css', '.'.repeat(secret.length), 0, secret.length, 'changed'); const out = await extractSourceSnippets(root, [empty, changed]); expect(out.findings[0]).toMatchObject({ findingId: 'empty', available: true }); expect(out.findings[1]).toMatchObject({ findingId: 'changed', available: false, reason: 'SOURCE_CHANGED' }); expect(JSON.stringify(out)).not.toContain(secret); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('uses code-unit ordering for non-ASCII paths and preserves all findings', async () => {
    const root = await temp(); const names = ['é.css', 'z.css', '😀.css']; try { for (const name of names) await writeFile(join(root, name), 'x'); const input = names.slice().reverse().map((name, index) => finding(name, 'x', 0, 1, `id-${index}`)); const out = await extractSourceSnippets(root, input); expect(out.findings.map(x => x.findingId)).toEqual(['id-1', 'id-2', 'id-0']); expect(out.sources.map(x => x.path)).toEqual(['z.css', 'é.css', '😀.css']); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('reports unsupported no-follow behavior when the platform lacks O_NOFOLLOW', async () => {
    const root = await temp(); try { await writeFile(join(root, 'a.css'), 'x'); const out = await extractSourceSnippets(root, [finding('a.css', 'x', 0)]); if (!constants.O_NOFOLLOW) expect(out.findings[0]).toMatchObject({ available: false, reason: 'UNSUPPORTED_NOFOLLOW' }); else expect(out.findings[0]?.available).toBe(true); } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('does not claim full snapshot identity when unrelated same-size content changes', async () => {
    const root = await temp(); const source = 'target\noriginal'; try { await writeFile(join(root, 'a.css'), source); const out = await extractSourceSnippets(root, [finding('a.css', source, 0, 6)]); expect(out.findings[0]?.available).toBe(true); } finally { await rm(root, { recursive: true, force: true }); }
  });
});

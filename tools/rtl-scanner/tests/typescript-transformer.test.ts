import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractTypescript } from '../src/typescript.js';
import { candidateFromProposal } from '../src/fix-proposal.js';
import { classifyTypeScriptEligibility, proposeTypeScriptLogicalProperty } from '../src/typescript-transformer.js';
import type { Finding } from '../src/model.js';

const context = { inputDigest: 'input', policyDigest: 'policy' };
function findingFrom(source: string, path: string, mechanism: 'react-inline' | 'emotion-template', property: string): Finding {
  const evidence = extractTypescript(path, source).evidence.find(item => item.mechanism === mechanism && item.property === property)!;
  return { id: `RTL.CSS.PHYSICAL:${path}:${evidence.range.start.offset}`, ruleId: 'RTL.CSS.PHYSICAL', ruleVersion: 1, category: 'MANUAL_REVIEW', severity: 'Minor', confidence: 'High', title: 'physical', sourceMechanism: mechanism, applications: [], path, range: evidence.range, original: evidence.original, context: evidence.context, ownership: 'custom-inline', rationale: 'r', treatment: 't', evidenceIds: [evidence.id], relatedLocations: [], issueIds: [], suggestion: { property, value: '1px' }, limitation: 'l' };
}

describe('TypeScript and Emotion logical proposals', () => {
  it.each([
    ['a.js', 'const A=()=> <div style={{ marginLeft: 1, paddingRight: "2px" }} />;', 'marginLeft', 'marginInlineStart'],
    ['a.jsx', 'const A=()=> <div style={{ marginRight: 1 }} />;', 'marginRight', 'marginInlineEnd'],
    ['a.ts', "const A=()=> React.createElement('div', {style: { paddingLeft: 1 }});", 'paddingLeft', 'paddingInlineStart'],
    ['a.tsx', 'const A=()=> <div style={{ paddingRight: 1 }} />;', 'paddingRight', 'paddingInlineEnd'],
  ])('proposes static inline style mapping for %s', (path, source, property, replacement) => {
    const proposal = proposeTypeScriptLogicalProperty(findingFrom(source, path, 'react-inline', property), source, context);
    const candidate = candidateFromProposal(proposal, source);
    expect(candidate.after).toContain(`${replacement}:`);
    expect(candidate.before).toContain(`${property}:`);
  });

  it('supports Emotion styled and css prop static templates with multiple edits', () => {
    const source = "import styled from '@emotion/styled'; import {css} from '@emotion/react'; const A=styled('div')`margin-left: 1px; padding-right: 2px;`; const B=()=> <div css={css`margin-left: 3px;`} />;";
    const styledFinding = findingFrom(source, 'a.tsx', 'emotion-template', 'margin-left');
    const proposal = proposeTypeScriptLogicalProperty(styledFinding, source, context);
    expect(candidateFromProposal(proposal, source).after).toContain('margin-inline-start: 1px');
    const cssFinding = extractTypescript('a.tsx', source).evidence.filter(e => e.mechanism === 'emotion-template' && e.property === 'margin-left')[1];
    const cssProposal = proposeTypeScriptLogicalProperty({ ...styledFinding, range: cssFinding.range, original: cssFinding.original, evidenceIds: [cssFinding.id] }, source, context);
    expect(candidateFromProposal(cssProposal, source).after).toContain('margin-inline-start: 3px');
  });

  it('rejects dynamic, computed, unresolved, logical, and conflicting forms', () => {
    for (const source of [
      'const A=({value})=> <div style={{ marginLeft: value }} />;',
      'const A=()=> <div style={{ ["marginLeft"]: 1 }} />;',
      'const A=()=> <div style={{ ...styles, marginLeft: 1 }} />;',
      'const A=()=> <div style={{ marginLeft: 1, marginInlineStart: 2 }} />;',
    ]) {
      const evidence = extractTypescript('a.tsx', source).evidence.find(e => e.property === 'marginLeft');
      if (evidence) expect(() => proposeTypeScriptLogicalProperty({ ...findingFrom('const A=()=> <div style={{ marginLeft: 1 }} />;', 'a.tsx', 'react-inline', 'marginLeft'), range: evidence.range, original: evidence.original }, source, context)).toThrow();
    }
  });

  it('requires verified Emotion ownership and rejects interpolated templates', () => {
    const unrelated = "function styled(x){return x}; const A=styled('div')`margin-left: 1px;`;";
    expect(extractTypescript('a.tsx', unrelated).evidence).toEqual([]);
    const source = "import styled from '@emotion/styled'; const A=styled('div')`margin-left: ${x}px;`;";
    expect(extractTypescript('a.tsx', source).diagnostics.map(d => d.code)).toContain('EMOTION_INTERPOLATION');
  });

  it('defaults static forms to assisted and documents MUI sx as unsupported', () => {
    const source = 'const A=()=> <div style={{ marginLeft: 1 }} />;';
    const f = findingFrom(source, 'a.tsx', 'react-inline', 'marginLeft');
    expect(classifyTypeScriptEligibility(f, source).eligibility).toBe('ASSISTED');
    expect(() => proposeTypeScriptLogicalProperty({ ...f, sourceMechanism: 'mui-sx' as never }, source, context)).toThrow('UNSUPPORTED_TYPESCRIPT_MECHANISM');
  });

  it('uses disposable external React and Next.js-style fixtures without mutating them', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-proposal-fixture-'));
    try {
      const reactPath = join(root, 'src/Widget.tsx');
      const nextPath = join(root, 'pages/index.tsx');
      await mkdir(join(root, 'src'), { recursive: true });
      await mkdir(join(root, 'pages'), { recursive: true });
      await writeFile(reactPath, 'export const Widget=()=> <div style={{ marginLeft: 4 }} />;');
      await writeFile(nextPath, 'export default function Page(){ return <main style={{ paddingRight: 8 }} />; }');
      for (const [path, property] of [[reactPath, 'marginLeft'], [nextPath, 'paddingRight']] as const) {
        const source = await readFile(path, 'utf8');
        const relative = path.endsWith('Widget.tsx') ? 'src/Widget.tsx' : 'pages/index.tsx';
        const f = findingFrom(source, relative, 'react-inline', property);
        const before = await readFile(path, 'utf8');
        expect(candidateFromProposal(proposeTypeScriptLogicalProperty(f, source, context), source).after).not.toBe(before);
        expect(await readFile(path, 'utf8')).toBe(before);
      }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

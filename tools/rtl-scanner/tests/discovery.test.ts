import { describe, expect, it as vitestIt } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { discover } from '../src/discovery.js';
import { scan } from '../src/scan.js';
import { json } from '../src/report.js';

const it = (name: string, fn: () => unknown) => name === 'skips symlinked files and directories without following them' && process.platform === 'win32'
  ? vitestIt.skip(`${name} (unprivileged Windows file/directory symlink fixtures unavailable)`, fn)
  : vitestIt(name, fn);

async function fixture() { return mkdtemp(join(realpathSync(tmpdir()), 'rtl-discovery-')); }
async function clean(root: string) { await rm(root, { recursive: true, force: true }); }

describe('project discovery', () => {
  it('discovers generic source, app, pages, root files, and excludes vendors/build output', async () => {
    const root = await fixture();
    try {
      await mkdir(join(root, 'src/components'), { recursive: true });
      await mkdir(join(root, 'app'), { recursive: true });
      await mkdir(join(root, 'pages'), { recursive: true });
      await mkdir(join(root, 'node_modules/pkg'), { recursive: true });
      await mkdir(join(root, 'dist'), { recursive: true });
      await writeFile(join(root, 'src/components/Button.tsx'), 'export const Button = () => null;');
      await writeFile(join(root, 'app/page.tsx'), 'export default function Page(){return <div/>;}');
      await writeFile(join(root, 'pages/index.tsx'), 'export default function Page(){return <div/>;}');
      await writeFile(join(root, 'index.html'), '<html dir="ltr"></html>');
      await writeFile(join(root, 'styles.css'), '.x { margin-left: 1px; }');
      await writeFile(join(root, 'node_modules/pkg/index.ts'), 'export const ignored = true;');
      await writeFile(join(root, 'dist/generated.css'), '.x { margin-left: 2px; }');
      const result = await discover(root);
      expect(result.files).toEqual(['app/page.tsx', 'index.html', 'pages/index.tsx', 'src/components/Button.tsx', 'styles.css']);
      expect(result.files.some(path => path.includes('node_modules') || path.startsWith('dist/'))).toBe(false);
      expect((await scan(root)).files).toEqual(result.files);
    } finally { await clean(root); }
  });

  it('preserves strict Nx detection and validation', async () => {
    const root = await fixture();
    try {
      await mkdir(join(root, 'apps')); await expect(discover(root)).rejects.toThrow('Incomplete Nx workspace');
      await mkdir(join(root, 'libs')); await mkdir(join(root, 'apps/demo/src'), { recursive: true });
      await writeFile(join(root, 'apps/demo/project.json'), '{"sourceRoot":"apps/demo/src"}');
      await writeFile(join(root, 'apps/demo/index.html'), '<html></html>');
      await writeFile(join(root, 'apps/demo/src/main.ts'), 'export const main = true;');
      expect((await discover(root)).files).toEqual(['apps/demo/index.html', 'apps/demo/src/main.ts']);
    } finally { await clean(root); }
  });

  it('skips symlinked files and directories without following them', async () => {
    const root = await fixture(); const outside = await fixture();
    try {
      await writeFile(join(outside, 'outside.ts'), 'export const outside = true;');
      await symlink(join(outside, 'outside.ts'), join(root, 'linked.ts'));
      await symlink(outside, join(root, 'linked-dir'));
      const result = await discover(root);
      expect(result.files).toEqual([]);
      expect(result.skipped.sort()).toEqual(['linked-dir', 'linked.ts']);
    } finally { await clean(root); await clean(outside); }
  });

  it('is deterministic across repeated generic scans', async () => {
    const root = await fixture();
    try {
      await mkdir(join(root, 'src')); await writeFile(join(root, 'src/b.ts'), 'export const b = 1;'); await writeFile(join(root, 'src/a.ts'), 'export const a = 1;');
      const first = await scan(root); const second = await scan(root);
      expect(first.files).toEqual(['src/a.ts', 'src/b.ts']); expect(json(first)).toBe(json(second));
    } finally { await clean(root); }
  });
});

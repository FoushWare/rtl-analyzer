import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';

const excludedDirectories = new Set(['node_modules', '.git', '.nx', 'dist', 'build', 'out', 'coverage', '.next', '.cache', 'test-results', 'playwright-report', '.vite', '.turbo']);
const supported = /\.(css|scss|tsx?|jsx?|html)$/;
const sourceLike = /\.(css|scss|sass|less|styl|tsx?|jsx?|html)$/;

export interface DiscoveryResult {
  root: string;
  files: string[];
  skipped: string[];
}

const compareNames = (a: { name: string }, b: { name: string }) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

async function walk(root: string, relative: string, files: Set<string>, skipped: string[]) {
  for (const entry of (await readdir(join(root, relative), { withFileTypes: true })).sort(compareNames)) {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) { skipped.push(path); continue; }
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) await walk(root, path, files, skipped);
      continue;
    }
    if (/^rtl-report(?:-|\.)/.test(entry.name) || entry.name === 'rtl-report-dashboard.html') continue;
    if (supported.test(path) && !path.endsWith('.stories.tsx')) {
      files.add(path);
    } else if (sourceLike.test(path) && !path.endsWith('.stories.tsx')) {
      skipped.push(path);
    }
  }
}

async function nxDiscovery(root: string): Promise<DiscoveryResult> {
  const files = new Set<string>();
  const skipped: string[] = [];
  for (const group of ['apps', 'libs']) {
    if ((await lstat(join(root, group))).isSymbolicLink()) throw new Error('Symlink project group not permitted');
  }
  for (const group of ['apps', 'libs']) for (const dir of (await readdir(join(root, group))).sort()) {
    const base = `${group}/${dir}`;
    if (!(await lstat(join(root, base))).isDirectory()) continue;
    const metadata = JSON.parse(await readFile(join(root, base, 'project.json'), 'utf8')) as { sourceRoot: string };
    if (!metadata.sourceRoot.startsWith(`${base}/`) || metadata.sourceRoot.includes('..')) throw new Error('Invalid sourceRoot');
    if ((await lstat(join(root, metadata.sourceRoot))).isSymbolicLink()) throw new Error('Symlink sourceRoot not permitted');
    await walk(root, metadata.sourceRoot, files, skipped);
    if (group === 'apps') {
      if ((await lstat(join(root, base, 'index.html'))).isSymbolicLink()) throw new Error('Symlink HTML not permitted');
      files.add(`${base}/index.html`);
    }
  }
  return { root, files: [...files].sort(), skipped: skipped.sort() };
}

export async function discover(rootInput: string): Promise<DiscoveryResult> {
  const root = await realpath(rootInput);
  const stat = await lstat(root);
  if (!stat.isDirectory()) throw new Error('Scan root must be a directory');
  const apps = await lstat(join(root, 'apps')).catch(() => undefined);
  const libs = await lstat(join(root, 'libs')).catch(() => undefined);
  if (apps || libs) {
    if (!apps?.isDirectory() || !libs?.isDirectory()) throw new Error('Incomplete Nx workspace: apps/ and libs/ are both required');
    return nxDiscovery(root);
  }
  const files = new Set<string>();
  const skipped: string[] = [];
  await walk(root, '', files, skipped);
  return { root, files: [...files].sort(), skipped: skipped.sort() };
}

import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkProjectDependencies, detectPackageManager, scriptExecutable } from '../src/preview-dependencies.js';

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'rtl-deps-'));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(root, path, '..'), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

const pkg = (extra: Record<string, unknown> = {}) => JSON.stringify({
  name: 'lab',
  scripts: { dev: 'vite --host 127.0.0.1 --port 4215' },
  devDependencies: { vite: '^6.4.5' },
  ...extra,
});
const vitePreview = [{ application: 'foundations', startupScript: 'dev' }];

describe('checkProjectDependencies', () => {
  it('reports missing dependencies when node_modules is absent, with the project path and npm ci for a lockfile project', async () => {
    const root = await project({ 'package.json': pkg(), 'package-lock.json': '{}' });
    const result = await checkProjectDependencies(root, vitePreview);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.code).toBe('PREVIEW_DEPENDENCIES_MISSING');
    expect(result.failure.message).toContain(`Project: ${root}`);
    expect(result.failure.message).toContain('Suggested command (run it in the project folder): npm ci');
    expect(result.failure.message).toContain('node_modules was not found');
  });

  it('suggests npm install when there is no lockfile', async () => {
    const root = await project({ 'package.json': pkg() });
    const result = await checkProjectDependencies(root, vitePreview);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.message).toContain('Suggested command (run it in the project folder): npm install');
  });

  it('passes when the Vite executable is installed in node_modules/.bin', async () => {
    const root = await project({ 'package.json': pkg(), 'node_modules/.bin/vite': '#!/bin/sh' });
    expect(await checkProjectDependencies(root, vitePreview)).toEqual({ ok: true });
  });

  it('names the missing executable when node_modules exists but Vite is not installed', async () => {
    const root = await project({ 'package.json': pkg(), 'node_modules/react/package.json': '{}' });
    const result = await checkProjectDependencies(root, vitePreview);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.message).toContain('the "vite" executable needed by "foundations" is not installed');
  });

  it('retries cleanly: the same project passes once dependencies are installed', async () => {
    const root = await project({ 'package.json': pkg() });
    expect((await checkProjectDependencies(root, vitePreview)).ok).toBe(false);
    await mkdir(join(root, 'node_modules/.bin'), { recursive: true });
    await writeFile(join(root, 'node_modules/.bin/vite'), '');
    expect(await checkProjectDependencies(root, vitePreview)).toEqual({ ok: true });
  });

  it('accepts a hoisted install in a monorepo workspace root', async () => {
    const root = await project({ 'package.json': pkg(), 'apps/lab/package.json': pkg(), 'node_modules/.bin/vite': '' });
    expect(await checkProjectDependencies(join(root, 'apps/lab'), vitePreview)).toEqual({ ok: true });
  });

  it('uses the Windows .cmd shim on win32', async () => {
    const root = await project({ 'package.json': pkg(), 'node_modules/.bin/vite.cmd': '' });
    expect(await checkProjectDependencies(root, vitePreview, 'win32')).toEqual({ ok: true });
    expect((await checkProjectDependencies(root, vitePreview, 'linux')).ok).toBe(false);
  });

  it('does not reject a project whose startup script runs an executable it does not declare', async () => {
    const root = await project({
      'package.json': JSON.stringify({ name: 'custom', scripts: { dev: 'node scripts/dev.mjs' } }),
    });
    expect(await checkProjectDependencies(root, [{ application: 'app', startupScript: 'dev' }])).toEqual({ ok: true });
  });

  it('skips the check for Yarn Plug\'n\'Play, which has no node_modules', async () => {
    const root = await project({ 'package.json': pkg(), '.pnp.cjs': '' });
    expect(await checkProjectDependencies(root, vitePreview)).toEqual({ ok: true });
  });

  it('never writes to the project: no node_modules is created and the lockfile is unchanged', async () => {
    const lock = JSON.stringify({ lockfileVersion: 3 });
    const root = await project({ 'package.json': pkg(), 'package-lock.json': lock });
    await checkProjectDependencies(root, vitePreview);
    expect(await readFile(join(root, 'package-lock.json'), 'utf8')).toBe(lock);
    await expect(readFile(join(root, 'node_modules/.bin/vite'), 'utf8')).rejects.toThrow();
  });
});

describe('detectPackageManager', () => {
  it('detects pnpm, yarn, and bun from lockfiles, with the matching install command', async () => {
    expect(await detectPackageManager(await project({ 'pnpm-lock.yaml': '' }))).toEqual({ name: 'pnpm', installCommand: 'pnpm install --frozen-lockfile' });
    expect(await detectPackageManager(await project({ 'yarn.lock': '' }))).toEqual({ name: 'yarn', installCommand: 'yarn install' });
    expect(await detectPackageManager(await project({ 'bun.lock': '' }))).toEqual({ name: 'bun', installCommand: 'bun install' });
  });

  it('uses npm ci with a package-lock.json and the packageManager field when present', async () => {
    expect(await detectPackageManager(await project({ 'package-lock.json': '{}' }))).toEqual({ name: 'npm', installCommand: 'npm ci' });
    expect(await detectPackageManager(await project({ 'package.json': '{"packageManager":"pnpm@9.0.0"}', 'yarn.lock': '' }))).toEqual({ name: 'pnpm', installCommand: 'pnpm install' });
  });

  it('defaults to npm install when nothing identifies the manager', async () => {
    expect(await detectPackageManager(await project({ 'package.json': '{}' }))).toEqual({ name: 'npm', installCommand: 'npm install' });
  });
});

describe('scriptExecutable', () => {
  it('finds the executable behind runners, env assignments, and flags', () => {
    expect(scriptExecutable('vite --host 127.0.0.1')).toBe('vite');
    expect(scriptExecutable('cross-env NODE_ENV=development vite')).toBe('vite');
    expect(scriptExecutable('npx nx serve app')).toBe('nx');
    expect(scriptExecutable('node scripts/dev.mjs')).toBeUndefined();
    expect(scriptExecutable('./scripts/dev.sh')).toBeUndefined();
  });
});

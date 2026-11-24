import { lstat, readFile } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';
import type { PreviewFailure } from './preview-orchestrator.js';

// Read-only dependency preflight for Live Preview. It runs before any project script starts, so a project without
// installed dependencies gets an actionable message instead of a generic startup failure. It never installs
// anything, never edits a lockfile, and never runs a package manager. A missing node_modules directory is only
// evidence, so the check also looks at the executable the startup script actually needs.

export const DEPENDENCIES_MISSING_CODE = 'PREVIEW_DEPENDENCIES_MISSING';

export type PackageManagerName = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface PackageManagerInfo {
  readonly name: PackageManagerName;
  /** Install command that respects an existing lockfile. Shown to the user; never run by RTL Analyzer. */
  readonly installCommand: string;
}

export interface PreflightApplication {
  readonly application: string;
  readonly startupScript?: string;
}

export type DependencyCheck = { readonly ok: true } | { readonly ok: false; readonly failure: PreviewFailure };

interface PackageJson {
  readonly packageManager?: unknown;
  readonly scripts?: Record<string, unknown>;
  readonly dependencies?: Record<string, unknown>;
  readonly devDependencies?: Record<string, unknown>;
  readonly optionalDependencies?: Record<string, unknown>;
}

/** Shell and runner words that are never the project's own executable. */
const RUNNERS = new Set(['cross-env', 'dotenv', 'env', 'exec', 'node', 'npm', 'npx', 'pnpm', 'yarn', 'bun', 'sh', 'run', 'bunx']);
/** Dev-server executables checked even when a project does not declare them (installed globally or hoisted). */
const KNOWN_EXECUTABLES = new Set(['vite', 'nx']);

async function exists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch {
    return false;
  }
}

/** Directories from `root` up to the filesystem root. Monorepos often hoist node_modules to the workspace root. */
function ancestors(root: string): string[] {
  const dirs: string[] = [];
  let current = root;
  for (;;) {
    dirs.push(current);
    const parent = dirname(current);
    if (parent === current || current === parse(current).root) break;
    current = parent;
  }
  return dirs;
}

async function findUp(root: string, name: string): Promise<string | undefined> {
  for (const dir of ancestors(root)) {
    if (await exists(join(dir, name))) return join(dir, name);
  }
  return undefined;
}

async function readPackageJson(root: string): Promise<PackageJson> {
  try {
    const parsed = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as PackageJson) : {};
  } catch {
    return {};
  }
}

function declaredDependencies(pkg: PackageJson): Set<string> {
  return new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {}), ...Object.keys(pkg.optionalDependencies ?? {})]);
}

/**
 * Chooses the package manager from the `packageManager` field, then from the lockfile nearest the project. npm is the
 * default, matching the startup runtime, which runs `npm run <script>` unless the project config names another manager.
 */
export async function detectPackageManager(root: string, pkg?: PackageJson): Promise<PackageManagerInfo> {
  const manifest = pkg ?? (await readPackageJson(root));
  const declared = typeof manifest.packageManager === 'string' ? manifest.packageManager.split('@')[0] : undefined;
  const lock = async (names: readonly string[]) => {
    for (const name of names) if (await findUp(root, name)) return true;
    return false;
  };
  const hasLock = {
    npm: await lock(['package-lock.json', 'npm-shrinkwrap.json']),
    pnpm: await lock(['pnpm-lock.yaml']),
    yarn: await lock(['yarn.lock']),
    bun: await lock(['bun.lock', 'bun.lockb']),
  };
  let name: PackageManagerName;
  if (declared === 'pnpm' || declared === 'yarn' || declared === 'bun' || declared === 'npm') name = declared;
  else if (hasLock.pnpm) name = 'pnpm';
  else if (hasLock.yarn) name = 'yarn';
  else if (hasLock.bun) name = 'bun';
  else name = 'npm';
  const installCommand = {
    npm: hasLock.npm ? 'npm ci' : 'npm install',
    pnpm: hasLock.pnpm ? 'pnpm install --frozen-lockfile' : 'pnpm install',
    yarn: 'yarn install',
    bun: 'bun install',
  }[name];
  return { name, installCommand };
}

/** The executable a script runs: the first word that is not a runner, an environment assignment, or a flag. */
export function scriptExecutable(script: string): string | undefined {
  for (const raw of script.trim().split(/\s+/)) {
    const word = raw.replace(/^["']|["']$/g, '');
    if (!word || word.includes('=') || word.startsWith('-') || word === '&&' || word === '||' || word === ';') continue;
    if (RUNNERS.has(word)) continue;
    if (/[/\\]/.test(word) || word.startsWith('.')) return undefined; // Local scripts are not package executables.
    return word;
  }
  return undefined;
}

/** True when `executable` exists in node_modules/.bin (or as a package) in the project or any ancestor. */
async function executableInstalled(root: string, executable: string, platform: NodeJS.Platform): Promise<boolean> {
  const binNames = platform === 'win32' ? [executable, `${executable}.cmd`] : [executable];
  for (const dir of ancestors(root)) {
    const modules = join(dir, 'node_modules');
    for (const bin of binNames) {
      if (await exists(join(modules, '.bin', bin))) return true;
    }
    if (await exists(join(modules, executable, 'package.json'))) return true;
  }
  return false;
}

/** True when node_modules exists in the project or in an ancestor (hoisted monorepo installs). */
async function anyNodeModules(root: string): Promise<boolean> {
  for (const dir of ancestors(root)) if (await exists(join(dir, 'node_modules'))) return true;
  return false;
}

/** Yarn Plug'n'Play has no node_modules; its dependencies are resolved by the runtime, so the check cannot apply. */
async function usesPlugAndPlay(root: string): Promise<boolean> {
  return (await findUp(root, '.pnp.cjs')) !== undefined || (await findUp(root, '.pnp.loader.mjs')) !== undefined;
}

function missing(root: string, reason: string, command: string, manager: PackageManagerName): PreviewFailure {
  return {
    code: DEPENDENCIES_MISSING_CODE,
    message: [
      `The project's dependencies are not installed: ${reason}.`,
      `Project: ${root}`,
      `Suggested command (run it in the project folder): ${command}`,
      `Install the dependencies with ${manager}, then choose Retry Preview. RTL Analyzer does not install packages for you.`,
    ].join('\n'),
  };
}

/**
 * Verifies that the executables the configured startup scripts need are installed. Only projects that already passed
 * the preview configuration check reach this point. A script whose executable cannot be identified is not rejected:
 * the check reports only what it can verify.
 */
export async function checkProjectDependencies(
  root: string,
  applications: readonly PreflightApplication[],
  platform: NodeJS.Platform = process.platform,
): Promise<DependencyCheck> {
  if (await usesPlugAndPlay(root)) return { ok: true };
  const pkg = await readPackageJson(root);
  const manager = await detectPackageManager(root, pkg);
  const declared = declaredDependencies(pkg);

  if (declared.size > 0 && !(await anyNodeModules(root))) {
    return { ok: false, failure: missing(root, 'node_modules was not found', manager.installCommand, manager.name) };
  }

  for (const app of applications) {
    const executable = app.startupScript !== undefined ? scriptExecutable(String((pkg.scripts ?? {})[app.startupScript] ?? '')) : 'vite';
    if (!executable) continue;
    if (!declared.has(executable) && !KNOWN_EXECUTABLES.has(executable)) continue;
    if (!(await executableInstalled(root, executable, platform))) {
      return {
        ok: false,
        failure: missing(root, `the "${executable}" executable needed by "${app.application}" is not installed`, manager.installCommand, manager.name),
      };
    }
  }
  return { ok: true };
}

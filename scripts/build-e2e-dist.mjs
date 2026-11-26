// Builds the scanner runtime used by the Playwright regression suites from the EXACT implementation pin (git objects,
// not the working tree) plus the wrapper overlays, and records provenance next to the output. The overlay modules are the
// only files read from the wrapper working tree; their hashes are recorded so a stale or edited overlay is detectable.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repo, 'dist', 'tools', 'rtl-scanner');
export const OVERLAY_MODULES = ['standalone-cli.ts', 'preview-orchestrator.ts', 'preview-services.ts', 'preview-dependencies.ts', 'preview-diagnostics.ts', 'dashboard-session.ts', 'dashboard-controls.ts'];
export const PROVENANCE_FILE = 'PROVENANCE.json';

const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

export function readPin() {
  return JSON.parse(readFileSync(join(repo, 'packages/rtl-analyzer/package.json'), 'utf8')).rtlAnalyzerImplementation.commit;
}

export function overlayHashes() {
  const src = join(repo, 'tools/rtl-scanner/src');
  return Object.fromEntries(OVERLAY_MODULES.map(name => [name, sha256(readFileSync(join(src, name)))]));
}

function main() {
  const implementation = join(repo, 'implementation');
  const pin = readPin();
  git(implementation, ['cat-file', '-e', `${pin}^{commit}`]);
  const stage = join(repo, `.build-e2e-stage-${process.pid}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(join(stage, 'src'), { recursive: true });
  try {
    // Pinned sources come from the object database of the pinned commit, so no untracked or edited file can enter.
    execFileSync('sh', ['-c', `git -C "${implementation}" archive ${pin} tools/rtl-scanner/src | tar -x -C "${join(stage, 'src')}" --strip-components=3`]);
    const pinned = new Set(readdirSync(join(stage, 'src')));
    for (const name of OVERLAY_MODULES) {
      if (pinned.has(name)) throw new Error(`overlay collides with pinned module: ${name}`);
      copyFileSync(join(repo, 'tools/rtl-scanner/src', name), join(stage, 'src', name));
    }
    const tsconfig = { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, esModuleInterop: true, skipLibCheck: true, types: ['node'], outDir: outDir, rootDir: join(stage, 'src') }, include: [join(stage, 'src', '*.ts')] };
    writeFileSync(join(stage, 'tsconfig.json'), JSON.stringify(tsconfig));
    rmSync(outDir, { recursive: true, force: true });
    execFileSync(process.execPath, [join(repo, 'node_modules/typescript/bin/tsc'), '-p', join(stage, 'tsconfig.json')], { stdio: 'inherit' });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  const outputs = Object.fromEntries(readdirSync(outDir).filter(n => n.endsWith('.js')).sort().map(n => [n, sha256(readFileSync(join(outDir, n)))]));
  const provenance = {
    builtAt: new Date().toISOString(),
    pin,
    implementationHead: git(implementation, ['rev-parse', 'HEAD']),
    wrapperHead: git(repo, ['rev-parse', 'HEAD']),
    wrapperOverlayDirtyFiles: git(repo, ['status', '--porcelain', '--', 'tools/rtl-scanner/src']).split('\n').filter(Boolean),
    overlays: overlayHashes(),
    outputs,
    node: process.version,
    typescript: JSON.parse(readFileSync(join(repo, 'node_modules/typescript/package.json'), 'utf8')).version,
  };
  writeFileSync(join(outDir, PROVENANCE_FILE), JSON.stringify(provenance, null, 2) + '\n');
  console.log(`E2E_DIST_BUILT pin=${pin} modules=${Object.keys(outputs).length} overlays=${OVERLAY_MODULES.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../../..');
const packageDir = join(repo, 'packages/rtl-analyzer');
const expectedVersion = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version;
const workspace = mkdtempSync(join(realpathSync(tmpdir()), 'rtl-analyzer-package-smoke-'));
const fixture = join(workspace, 'fixture');
const external = join(workspace, 'external');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is required to run the package smoke test');
const npxCli = join(dirname(npmCli), 'npx-cli.js');
const runNpm = (args, options) => execFileSync(process.execPath, [npmCli, ...args], options);
const runNpx = (args, options) => execFileSync(process.execPath, [npxCli, ...args], options);
mkdirSync(join(fixture, 'src'), { recursive: true });
mkdirSync(external);
writeFileSync(join(fixture, 'index.html'), '<html dir="ltr"></html>\n');
writeFileSync(join(fixture, 'src/styles.css'), '.page { margin-left: 12px; }\n');

const pack = JSON.parse(runNpm(['pack', '--json'], { cwd: packageDir, encoding: 'utf8' }))[0];
const tarball = join(packageDir, pack.filename);
const tarCommand = process.platform === 'win32' ? 'tar.exe' : 'tar';
const entries = execFileSync(tarCommand, ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n');
if (entries.some(entry => /(^|\/)(tests|apps|libs|node_modules|\.git)(\/|$)|Atlas|phase-3-rtl/.test(entry))) {
  throw new Error('Package contains excluded repository content');
}
runNpm(['init', '-y'], { cwd: external, stdio: 'ignore' });
runNpm(['install', '--ignore-scripts', tarball], { cwd: external, stdio: 'inherit' });
const run = (args) => runNpx(['--no-install', 'rtl-analyzer', ...args], { cwd: external, encoding: 'utf8' });
if (!run(['--help']).includes('rtl-analyzer scan')) throw new Error('CLI help failed');
if (run(['--version']).trim() !== expectedVersion) throw new Error(`CLI version failed: expected ${expectedVersion}`);
for (const format of ['json', 'markdown', 'dashboard']) {
  const output = join(workspace, format);
  mkdirSync(output);
  run(['scan', fixture, '--format', format, '--output-dir', output]);
}
const dashboard = readdirSync(join(workspace, 'dashboard'));
if (!dashboard.includes('rtl-report-dashboard.html')) throw new Error('Dashboard output missing');
const installed = join(external, 'node_modules/rtl-analyzer');
const installedFiles = [];
const collectFiles = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(path);
    else if (entry.isFile()) installedFiles.push(path);
  }
};
collectFiles(installed);
if (/rtl-analyzer-cli-dev|css-migrations-rtl/.test(installedFiles.join('\n'))) throw new Error('Installed package references source checkout');
console.log(`Standalone package smoke passed: ${entries.length} tarball files; workspace=${workspace}`);

import { cpSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const workspace = mkdtempSync(join(realpathSync(tmpdir()), 'rtl-analyzer-e2e-'));
const project = join(workspace, 'project');
const state = join(workspace, 'state');
const dashboard = join(workspace, 'dashboard');
mkdirSync(join(state, 'backups'), { recursive: true });

for (const name of ['apps', 'libs']) cpSync(join(repo, name), join(project, name), { recursive: true });
for (const name of ['package.json', 'tsconfig.json', 'nx.json']) cpSync(join(repo, name), join(project, name));
symlinkSync(join(repo, 'node_modules'), join(project, 'node_modules'), 'dir');
mkdirSync(dashboard, { recursive: true });
execFileSync(process.execPath, [join(repo, 'dist/tools/rtl-scanner/cli.js'), '--root', repo, '--format', 'dashboard', '--output-dir', dashboard], { cwd: repo, stdio: 'ignore' });

process.env.RTL_E2E_REPO = repo;
process.env.RTL_E2E_PROJECT = project;
process.env.RTL_E2E_STATE = state;
process.env.RTL_E2E_DASHBOARD = dashboard;
process.env.RTL_E2E_FIXTURE_ROOT = project;
process.env.RTL_E2E_REPORT = join(dashboard, 'rtl-report.json');
process.on('exit', () => rmSync(workspace, { recursive: true, force: true }));

export { dashboard, project, repo, state };

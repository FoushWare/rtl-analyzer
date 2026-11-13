#!/usr/bin/env node
import { lstat, mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { runCli, type CliIO } from './cli.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const browserLaunchTimeoutMs = 5_000;

async function version(): Promise<string> {
  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { version?: string };
  return packageJson.version ?? '0.0.0';
}

function help(): string {
  return `RTL Analyzer — conservative RTL risk scanning\n\nUsage:\n  rtl-analyzer                    Scan the current directory and open a dashboard\n  rtl-analyzer scan [path] [options]\n  rtl-analyzer --help\n  rtl-analyzer --version\n\nOptions:\n  --root <path>                 Scan this project root\n  --format <format>             json, markdown, markdown-structured, or dashboard\n  --output-dir <path>           Write report artifacts to this directory\n  --fail-on-findings            Exit 1 when actionable findings exist\n  --embed-source-snippets       Embed bounded source snippets in dashboard output\n`;
}

const io: CliIO = {
  writeStdout: value => process.stdout.write(value),
  writeStderr: value => process.stderr.write(`${value}\n`),
};

type Launcher = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

export function isDirectExecution(invokedPath: string | null, modulePath: string | null, platform = process.platform): boolean {
  if (!invokedPath || !modulePath) return false;
  return platform === 'win32' ? invokedPath.toLowerCase() === modulePath.toLowerCase() : invokedPath === modulePath;
}

export async function openDashboard(path: string, platform = process.platform, launcher: Launcher = spawn, timeoutMs = browserLaunchTimeoutMs): Promise<boolean> {
  const command = platform === 'darwin' ? 'open' : platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  return new Promise(resolve => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    let child: ReturnType<typeof spawn> | undefined;
    const finish = (opened: boolean) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (child) {
        child.removeListener('error', onError);
        child.removeListener('close', onClose);
      }
      resolve(opened);
    };
    const onError = () => finish(false);
    const onClose = (code: number | null) => finish(code === 0);
    try {
      child = launcher(command, [path], { stdio: 'ignore', shell: false });
      child.once('error', onError);
      child.once('close', onClose);
      timer = setTimeout(() => {
        try { child?.kill(); } catch { /* browser process cleanup is best effort */ }
        finish(false);
      }, timeoutMs);
    } catch {
      finish(false);
    }
  });
}

export interface DefaultDashboardOptions {
  readonly io?: CliIO;
  readonly run?: typeof runCli;
  readonly open?: typeof openDashboard;
  readonly tempRoot?: string;
}

export async function runDefaultDashboard(options: DefaultDashboardOptions = {}): Promise<number> {
  const outputDir = await mkdtemp(join(await realpath(options.tempRoot ?? tmpdir()), 'rtl-analyzer-dashboard-'));
  const dashboardPath = join(outputDir, 'rtl-report-dashboard.html');
  const output = options.io ?? io;
  const code = await (options.run ?? runCli)(['--root', process.cwd(), '--format', 'dashboard', '--output-dir', outputDir], output);
  let dashboardExists = false;
  try { dashboardExists = (await lstat(dashboardPath)).isFile(); } catch { /* report the scan error below */ }
  if (!dashboardExists) {
    output.writeStderr(`Dashboard was not generated: ${dashboardPath}`);
    return code === 0 ? 2 : code;
  }
  output.writeStderr(`Dashboard: ${dashboardPath}`);
  if (!(await (options.open ?? openDashboard)(dashboardPath))) output.writeStderr(`Could not open dashboard automatically. Open: ${dashboardPath}`);
  return code;
}

export async function main(argv: string[], output: CliIO = io): Promise<number> {
  if (argv.length === 0) return runDefaultDashboard({ io: output });
  if (argv[0] === '--help' || argv[0] === '-h') {
    output.writeStdout(help());
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    output.writeStdout(`${await version()}\n`);
    return 0;
  }
  if (argv[0] !== 'scan') {
    output.writeStderr(`Unknown command: ${argv[0]}. Use --help for usage.`);
    return 2;
  }
  const scanArgs = argv.slice(1);
  const firstPath = scanArgs[0];
  if (firstPath && !firstPath.startsWith('-')) {
    scanArgs.splice(0, 1, '--root', firstPath);
  }
  return runCli(scanArgs, output);
}

const invokedPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
const modulePath = await realpath(fileURLToPath(import.meta.url)).catch(() => null);
if (isDirectExecution(invokedPath, modulePath)) process.exitCode = await main(process.argv.slice(2));

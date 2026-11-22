#!/usr/bin/env node
import { lstat, mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { runCli, type CliIO } from './cli.js';
import { decidePreviewConsent, inspectPreviewProject, type PreviewEligibility } from './preview-orchestrator.js';
import { COMPANION_PORT, startPreviewServices, type ReleaseOutcome, type ServiceResult } from './preview-services.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const browserLaunchTimeoutMs = 5_000;

async function version(): Promise<string> {
  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { version?: string };
  return packageJson.version ?? '0.0.0';
}

function help(): string {
  return `RTL Analyzer — conservative RTL risk scanning\n\nUsage:\n  rtl-analyzer                    Scan the current directory and open a dashboard\n  rtl-analyzer scan [path] [options]\n  rtl-analyzer preview [--help]\n  rtl-analyzer --help\n  rtl-analyzer --version\n  rtl-analyzer --approve-project-scripts   Authorize running the project's dev server for live preview\n\nOptions:\n  --root <path>                 Scan this project root\n  --format <format>             json, markdown, markdown-structured, or dashboard\n  --output-dir <path>           Write report artifacts to this directory\n  --fail-on-findings            Exit 1 when actionable findings exist\n  --embed-source-snippets       Embed bounded source snippets in dashboard output\n`;
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

export interface PreviewPlanOptions {
  /** Explicit authorization for project scripts (`--approve-project-scripts`). */
  readonly authorized?: boolean;
  readonly interactive?: boolean;
  readonly ask?: (question: string) => Promise<string>;
  readonly inspect?: (root: string) => Promise<PreviewEligibility>;
  /** Starts the packaged companion and dashboard server; injectable for tests. */
  readonly start?: (options: Parameters<typeof startPreviewServices>[0]) => Promise<ServiceResult>;
  /** Resolves when the user asks to stop (Ctrl-C or SIGTERM). Injectable for tests. */
  readonly waitForStop?: () => Promise<void>;
}

export interface DefaultDashboardOptions {
  readonly io?: CliIO;
  readonly run?: typeof runCli;
  readonly open?: typeof openDashboard;
  readonly tempRoot?: string;
  readonly root?: string;
  readonly preview?: PreviewPlanOptions;
}

const APPROVE_PROJECT_SCRIPTS = '--approve-project-scripts';

/** Says so when the companion did not confirm this run's release, so the user knows a server may still be running. */
function reportRelease(outcome: ReleaseOutcome, output: CliIO): void {
  if (outcome !== 'release-failed') return;
  output.writeStderr(`The preview companion did not confirm this run's release. The original application server may still be running; stop the preview companion on port ${COMPANION_PORT} to end it.`);
}

/** Aborts on Ctrl-C or SIGTERM. Installed before services start, so startup can be cancelled too. */
function stopSignalController(): AbortController {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return controller;
}

function abortPromise(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => { if (signal.aborted) resolve(); else signal.addEventListener('abort', () => resolve(), { once: true }); });
}

async function promptUser(question: string): Promise<string> {
  const prompt = createInterface({ input: process.stdin, output: process.stderr });
  try { return await prompt.question(question); } finally { prompt.close(); }
}

export async function runDefaultDashboard(options: DefaultDashboardOptions = {}): Promise<number> {
  const outputDir = await mkdtemp(join(await realpath(options.tempRoot ?? tmpdir()), 'rtl-analyzer-dashboard-'));
  const dashboardPath = join(outputDir, 'rtl-report-dashboard.html');
  const output = options.io ?? io;
  const root = options.root ?? process.cwd();
  // Source snippets are part of the default workflow; they are embedded only inside the external dashboard output.
  // The scan writes the dashboard into outputDir; its HTML must not be echoed to the terminal.
  const scanIo: CliIO = { writeStdout: () => undefined, writeStderr: value => output.writeStderr(value) };
  const code = await (options.run ?? runCli)(['--root', root, '--format', 'dashboard', '--output-dir', outputDir, '--embed-source-snippets'], scanIo);
  let dashboardExists = false;
  try { dashboardExists = (await lstat(dashboardPath)).isFile(); } catch { /* report the scan error below */ }
  if (!dashboardExists) {
    output.writeStderr(`Dashboard was not generated: ${dashboardPath}`);
    return code === 0 ? 2 : code;
  }
  output.writeStderr(`Dashboard: ${dashboardPath}`);

  const preview = options.preview ?? {};
  const eligibility = await (preview.inspect ?? inspectPreviewProject)(root);
  if (!eligibility.eligible) {
    output.writeStderr(`Live Preview Unavailable: ${eligibility.failure.message} The static report is available.`);
  } else {
    const decision = await decidePreviewConsent(eligibility, {
      authorized: preview.authorized,
      interactive: preview.interactive ?? Boolean(process.stdin.isTTY && process.stderr.isTTY),
      ask: preview.ask ?? promptUser,
      write: line => output.writeStderr(line),
    });
    if (!decision.approved) {
      output.writeStderr(`Live preview not started: ${decision.failure.message}`);
    } else {
      const stopSignal = stopSignalController();
      const services = await (preview.start ?? startPreviewServices)({
        root,
        reportPath: join(outputDir, 'rtl-report.json'),
        dashboardDir: outputDir,
        companionEntry: join(dirname(fileURLToPath(import.meta.url)), 'preview-cli.js'),
        log: line => output.writeStderr(line),
        signal: stopSignal.signal,
      });
      if (services.state === 'ready') {
        output.writeStderr(`Live preview ready: ${services.dashboardUrl}`);
        if (!(await (options.open ?? openDashboard)(services.dashboardUrl))) output.writeStderr(`Could not open dashboard automatically. Open: ${services.dashboardUrl}`);
        await (preview.waitForStop ?? (() => abortPromise(stopSignal.signal)))();
        output.writeStderr('Stopping live preview services owned by this run.');
        reportRelease(await services.stop(), output);
        return code;
      }
      reportRelease(await services.stop(), output);
      // A Ctrl-C during startup ends the run; it must not open a browser.
      if (stopSignal.signal.aborted) {
        output.writeStderr('Live preview startup cancelled. Owned services were stopped.');
        return code;
      }
      output.writeStderr(`${services.state === 'unsupported' ? 'Live Preview Unavailable' : "Couldn't Start Live Preview"}: ${services.failure.message} The static report is available.`);
    }
  }

  if (!(await (options.open ?? openDashboard)(dashboardPath))) output.writeStderr(`Could not open dashboard automatically. Open: ${dashboardPath}`);
  return code;
}

export async function main(argv: string[], output: CliIO = io): Promise<number> {
  if (argv.length === 0) return runDefaultDashboard({ io: output });
  if (argv.length === 1 && argv[0] === APPROVE_PROJECT_SCRIPTS) return runDefaultDashboard({ io: output, preview: { authorized: true } });
  if (argv[0] === '--help' || argv[0] === '-h') {
    output.writeStdout(help());
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    output.writeStdout(`${await version()}\n`);
    return 0;
  }
  if (argv[0] === 'preview') {
    // The preview CLI consumes process argv and stays lazy for read-only scans.
    if (argv.slice(1).some(arg => !['--help', '-h'].includes(arg)) || argv.length > 2) {
      output.writeStderr('Unknown option. Use rtl-analyzer preview --help.');
      return 2;
    }
    if (argv.length === 2) {
      output.writeStdout('Usage: RTL_PROJECT_ROOT=/absolute/project rtl-preview (or rtl-analyzer preview)\nServe dashboard reports on http://127.0.0.1:4320. See README for project, preview, Chromium and state prerequisites.\n');
      return 0;
    }
    await import('./preview-companion.js');
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

#!/usr/bin/env node
import { lstat, mkdtemp, readFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { runCli, type CliIO } from './cli.js';
import { decidePreviewConsent, inspectPreviewProject, startupNotice, type PreviewEligibility } from './preview-orchestrator.js';
import { DASHBOARD_PORT, startPreviewServices, type ServiceResult } from './preview-services.js';
import { DashboardSession } from './dashboard-session.js';
import { checkProjectDependencies, type DependencyCheck, type PreflightApplication } from './preview-dependencies.js';
import type { PreviewFailure } from './preview-orchestrator.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const browserLaunchTimeoutMs = 5_000;

async function version(): Promise<string> {
  const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as { version?: string };
  return packageJson.version ?? '0.0.0';
}

function help(): string {
  return `RTL Analyzer — conservative RTL risk scanning\n\nUsage:\n  rtl-analyzer                    Scan the current directory and open a dashboard\n  rtl-analyzer scan [path] [options]\n  rtl-analyzer preview [--help]\n  rtl-analyzer --help\n  rtl-analyzer --version\n  rtl-analyzer --no-project-scripts        Do not start the project's dev server (static report only)\n\nOptions:\n  --root <path>                 Scan this project root\n  --format <format>             json, markdown, markdown-structured, or dashboard\n  --output-dir <path>           Write report artifacts to this directory\n  --fail-on-findings            Exit 1 when actionable findings exist\n  --embed-source-snippets       Embed bounded source snippets in dashboard output\n`;
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
  /** Accepted for compatibility (`--approve-project-scripts`); project startup is already the default. */
  readonly authorized?: boolean;
  /** Explicit opt-out (`--no-project-scripts`): no project script runs. */
  readonly optOut?: boolean;
  readonly interactive?: boolean;
  /** Checks that the executables the startup scripts need are installed. Injectable for tests. */
  readonly dependencies?: (root: string, applications: readonly PreflightApplication[]) => Promise<DependencyCheck>;
  readonly inspect?: (root: string) => Promise<PreviewEligibility>;
  /** Starts the packaged companion and dashboard server; injectable for tests. */
  readonly start?: (options: Parameters<typeof startPreviewServices>[0]) => Promise<ServiceResult>;
  /** Dashboard port; tests use 0 for an ephemeral port. Default: the fixed port the companion accepts. */
  readonly dashboardPort?: number;
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
const NO_PROJECT_SCRIPTS = '--no-project-scripts';

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
  const interactive = preview.interactive ?? Boolean(process.stdin.isTTY && process.stderr.isTTY);
  const eligibility = await (preview.inspect ?? inspectPreviewProject)(root);
  const startServices = async (signal: AbortSignal): Promise<ServiceResult> => {
    // Runs before any project script. A clearly missing dependency is reported as setup, not as a doomed startup.
    const applications = eligibility.eligible ? eligibility.applications : [];
    const dependencies = await (preview.dependencies ?? checkProjectDependencies)(root, applications);
    if (!dependencies.ok) return { state: 'startup_failed', failure: dependencies.failure, stop: async () => 'not-held' };
    // Announced only now: the dependency check has passed, and this attempt starts the dev server right away.
    if (eligibility.eligible) for (const line of startupNotice(eligibility.commands)) output.writeStderr(line);
    return (preview.start ?? startPreviewServices)({
      root,
      reportPath: join(outputDir, 'rtl-report.json'),
      logDir: outputDir,
      companionEntry: join(dirname(fileURLToPath(import.meta.url)), 'preview-cli.js'),
      log: line => output.writeStderr(line),
      signal,
    });
  };

  if (!eligibility.eligible) {
    if (interactive) return runSession(options, outputDir, dashboardPath, code, { initial: { state: 'unsupported', failure: eligibility.failure }, interactive: true });
    output.writeStderr(`Live Preview Unavailable: ${eligibility.failure.message} The static report is available.`);
  } else {
    const decision = await decidePreviewConsent(eligibility, {
      authorized: preview.authorized,
      optOut: preview.optOut,
      interactive,
    });
    if (!decision.approved) {
      output.writeStderr(`Live preview not started: ${decision.failure.message}`);
    } else {
      return runSession(options, outputDir, dashboardPath, code, { start: startServices, interactive });
    }
  }

  if (!(await (options.open ?? openDashboard)(dashboardPath))) output.writeStderr(`Could not open dashboard automatically. Open: ${dashboardPath}`);
  return code;
}

interface SessionRequest {
  /** Startup attempt for an approved project. */
  readonly start?: (signal: AbortSignal) => Promise<ServiceResult>;
  /** Interactive runs keep the page open so the preview modal can offer Retry, Continue, and Cancel. */
  readonly interactive?: boolean;
  /** A state that needs no attempt, such as an unsupported project. */
  readonly initial?: { state: 'unsupported'; failure: PreviewFailure };
}

/**
 * Serves the dashboard for this run and drives the preview state. The CLI stays up until End Review, Ctrl-C, or
 * (non-interactive runs only) a failed startup, which falls back to the static report and exits.
 */
async function runSession(options: DefaultDashboardOptions, outputDir: string, dashboardPath: string, code: number, request: SessionRequest): Promise<number> {
  const output = options.io ?? io;
  const preview = options.preview ?? {};
  const session = new DashboardSession({
    dashboardDir: outputDir,
    start: request.start,
    log: line => output.writeStderr(line),
    port: preview.dashboardPort,
  });
  const openPage = options.open ?? openDashboard;
  try {
    await session.listen();
  } catch (error) {
    // Same wording as the earlier port check, so a busy dashboard port reads the same to the user.
    const port = preview.dashboardPort ?? DASHBOARD_PORT;
    const busy = (error as NodeJS.ErrnoException | undefined)?.code === 'EADDRINUSE';
    output.writeStderr(busy
      ? `Couldn't Start Live Preview: Port ${port} is in use by another process. RTL Analyzer did not stop it; free the port and retry. The static report is available.`
      : "Couldn't Start Live Preview: The local dashboard server did not answer. The static report is available.");
    if (!(await openPage(dashboardPath))) output.writeStderr(`Could not open dashboard automatically. Open: ${dashboardPath}`);
    return code;
  }
  const stopSignal = stopSignalController();
  stopSignal.signal.addEventListener('abort', () => { void session.end(); }, { once: true });

  if (request.initial) session.setInitial(request.initial.state, request.initial.failure);
  const attempt = request.start ? session.begin() : undefined;
  if (!request.interactive && attempt) {
    await attempt;
    if (session.status().state !== 'ready') {
      output.writeStderr(`Couldn't Start Live Preview: ${session.status().failure?.message ?? 'Startup failed.'} The static report is available.`);
      await session.end();
      if (!(await openPage(dashboardPath))) output.writeStderr(`Could not open dashboard automatically. Open: ${dashboardPath}`);
      return code;
    }
  }

  if (session.status().state === 'ready') output.writeStderr(`Live preview ready: ${session.url}`);
  output.writeStderr(`Dashboard: ${session.url}`);
  if (!(await openPage(session.url))) output.writeStderr(`Could not open dashboard automatically. Open: ${session.url}`);
  void (preview.waitForStop ?? (() => abortPromise(stopSignal.signal)))().then(() => session.end());
  await session.waitForEnd();
  output.writeStderr('Live preview services owned by this run were stopped.');
  return code;
}

/**
 * Project-script flags apply only to the default dashboard command. Any other argument list is left to its own command,
 * which keeps its existing argument checks.
 */
export function parseProjectScriptFlags(argv: readonly string[]): { isDefaultCommand: boolean; authorized: boolean; optOut: boolean; error?: string } {
  const authorized = argv.includes(APPROVE_PROJECT_SCRIPTS);
  const optOut = argv.includes(NO_PROJECT_SCRIPTS);
  // Flags count only when nothing else is on the command line (the bare `rtl-analyzer` command with flags).
  const isDefaultCommand = argv.every(arg => arg === APPROVE_PROJECT_SCRIPTS || arg === NO_PROJECT_SCRIPTS);
  if (!isDefaultCommand) return { isDefaultCommand, authorized: false, optOut: false };
  if (authorized && optOut) return { isDefaultCommand, authorized, optOut, error: APPROVE_PROJECT_SCRIPTS + ' and ' + NO_PROJECT_SCRIPTS + ' cannot be used together.' };
  return { isDefaultCommand, authorized, optOut };
}

export async function main(argv: string[], output: CliIO = io): Promise<number> {
  const scriptFlags = parseProjectScriptFlags(argv);
  if (scriptFlags.error) {
    output.writeStderr(scriptFlags.error);
    return 2;
  }
  if (scriptFlags.isDefaultCommand) return runDefaultDashboard({ io: output, preview: { authorized: scriptFlags.authorized, optOut: scriptFlags.optOut } });
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

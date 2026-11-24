import { homedir } from 'node:os';

// Turns a failed Live Preview startup into a plain explanation and a bounded, redacted technical record. The
// explanation is written from fixed text; raw child output is only ever shown after redaction, and never as markup.

export const STARTUP_CATEGORIES = [
  'missing-dependency',
  'missing-script',
  'port-in-use',
  'permission',
  'compile-error',
  'unexpected-exit',
  'startup-timeout',
  'companion-connection',
  'unknown',
] as const;
export type StartupCategory = (typeof STARTUP_CATEGORIES)[number];

/** Evidence gathered by the runtime (or the service). Everything here is optional: classification uses what exists. */
export interface StartupEvidence {
  readonly code: string;
  readonly reason?: string;
  readonly exitCode?: number | null;
  readonly signal?: string | null;
  readonly spawnErrorCode?: string;
  readonly command?: string;
  readonly startupScript?: string;
  readonly cwd?: string;
  readonly port?: number;
  readonly waitedMs?: number;
  readonly output?: string;
  readonly packageManager?: string;
  /** Install command chosen from the project's lockfile (see detectPackageManager). Used as-is when present. */
  readonly installCommand?: string;
}

export interface StartupDiagnostic {
  readonly category: StartupCategory;
  readonly code: string;
  readonly title: string;
  readonly explanation: string;
  /** A command the user may copy and run themselves. RTL Analyzer never runs it. */
  readonly recovery?: string;
  readonly technical: {
    readonly reason?: string;
    readonly exitCode?: number | null;
    readonly signal?: string | null;
    readonly spawnErrorCode?: string;
    readonly command?: string;
    readonly startupScript?: string;
    readonly cwd?: string;
    readonly port?: number;
    readonly waitedMs?: number;
    readonly output: string;
  };
}

const OUTPUT_LIMIT = 2000;
const LINE_LIMIT = 300;
const LINE_COUNT_LIMIT = 30;

/**
 * Redacts text before it is shown or copied: ANSI escapes and control characters are removed, credentials in URLs,
 * bearer tokens and secret-named values are masked, environment-style lines are dropped, and the home directory
 * becomes `~`. Output stays bounded in lines, line length and total size. Idempotent.
 */
export function sanitizeDiagnosticText(text: string, home = homedir()): string {
  const withoutControl = text
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  const redacted = withoutControl
    .split(home.length > 1 ? home : '\u0000').join('~')
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/((?:token|secret|password|passwd|api[_-]?key|authorization|cookie|credential)[\w.-]*\s*[=:]\s*)\S+/gi, '$1[redacted]')
    .replace(/^[ \t]*[A-Z][A-Z0-9_]{2,}=.*$/gm, '[environment line removed]');
  return redacted
    .split('\n')
    .slice(-LINE_COUNT_LIMIT)
    .map(line => line.slice(0, LINE_LIMIT))
    .join('\n')
    .slice(-OUTPUT_LIMIT)
    .trim();
}

const LOCKFILE_COMMANDS: Readonly<Record<string, { readonly lockfile: string; readonly command: string }>> = {
  npm: { lockfile: 'package-lock.json', command: 'npm ci' },
  pnpm: { lockfile: 'pnpm-lock.yaml', command: 'pnpm install --frozen-lockfile' },
  yarn: { lockfile: 'yarn.lock', command: 'yarn install --frozen-lockfile' },
  bun: { lockfile: 'bun.lockb', command: 'bun install --frozen-lockfile' },
};

/** The install command for the detected package manager. Shown as text only; RTL Analyzer never installs anything. */
export function installCommandFor(packageManager: string | undefined, lockfile: string | undefined): string {
  const known = LOCKFILE_COMMANDS[packageManager ?? 'npm'] ?? LOCKFILE_COMMANDS.npm;
  if (packageManager === 'npm' || packageManager === undefined) return lockfile === 'package-lock.json' ? known.command : 'npm install';
  return known.command;
}

function toolFromOutput(output: string): string | undefined {
  const match = /(?:sh|bash|zsh): ([A-Za-z0-9._@/-]{1,60}): (?:command )?not found|command not found: ([A-Za-z0-9._@/-]{1,60})/.exec(output);
  const name = match?.[1] ?? match?.[2];
  return name && /^[A-Za-z0-9._@/-]+$/.test(name) ? name : undefined;
}

/**
 * Chooses one category from the evidence, most specific first. A category is only claimed when the evidence supports
 * it; anything else is `unknown`, which still shows the redacted technical details.
 */
export function classifyStartupFailure(evidence: StartupEvidence, home = homedir()): StartupDiagnostic {
  const output = sanitizeDiagnosticText(evidence.output ?? '', home);
  const technical = {
    ...(evidence.reason ? { reason: evidence.reason } : {}),
    ...(evidence.exitCode !== undefined ? { exitCode: evidence.exitCode } : {}),
    ...(evidence.signal !== undefined ? { signal: evidence.signal } : {}),
    ...(evidence.spawnErrorCode ? { spawnErrorCode: evidence.spawnErrorCode } : {}),
    ...(evidence.command ? { command: evidence.command } : {}),
    ...(evidence.startupScript ? { startupScript: evidence.startupScript } : {}),
    ...(evidence.cwd ? { cwd: evidence.cwd.replace(home.length > 1 ? home : '\u0000', '~') } : {}),
    ...(evidence.port !== undefined ? { port: evidence.port } : {}),
    ...(evidence.waitedMs !== undefined ? { waitedMs: evidence.waitedMs } : {}),
    output,
  };
  const make = (category: StartupCategory, title: string, explanation: string, recovery?: string): StartupDiagnostic => ({
    category,
    code: evidence.code,
    title,
    explanation,
    ...(recovery ? { recovery } : {}),
    technical,
  });
  const install = evidence.installCommand ?? installCommandFor(evidence.packageManager, undefined);
  const script = evidence.startupScript ?? 'dev';
  const runScript = `${evidence.packageManager ?? 'npm'} run ${script}`;

  if (evidence.code === 'PREVIEW_STARTUP_SCRIPT_MISSING' || /\bmissing script\b/i.test(output)) {
    return make('missing-script', 'The startup script is missing', `package.json no longer defines the "${script}" script named in rtl-preview.config.json. Add the script back or update the configuration, then choose Retry Preview.`);
  }
  if (evidence.code === 'ORIGINAL_PREVIEW_PORT_OCCUPIED' || evidence.code === 'PORT_CONFLICT_COMPANION' || /EADDRINUSE|address already in use|port \d+ is (?:already )?in use/i.test(output)) {
    const port = evidence.port !== undefined ? ` ${evidence.port}` : '';
    return make('port-in-use', 'The preview port is already in use', `Port${port} is in use by another process. RTL Analyzer did not stop it. Free the port or stop the other process, then choose Retry Preview.`);
  }
  if (evidence.spawnErrorCode === 'ENOENT') {
    const tool = evidence.packageManager ?? 'npm';
    return make('missing-dependency', `${tool} could not be started`, `RTL Analyzer could not find the ${tool} command. Install it or add it to PATH, then choose Retry Preview.`);
  }
  if (evidence.spawnErrorCode === 'EACCES' || evidence.spawnErrorCode === 'EPERM' || /\bEACCES\b|\bEPERM\b|permission denied/i.test(output)) {
    return make('permission', 'The dev server could not be started', 'The operating system denied access while starting the dev server. Check the permissions of the project folder and its node_modules, then choose Retry Preview.');
  }
  const missingTool = toolFromOutput(output);
  if (missingTool || /Cannot find (?:module|package)|ERR_MODULE_NOT_FOUND/.test(output)) {
    const subject = missingTool ? `${missingTool} is not installed in this project` : 'Project dependencies appear to be missing';
    return make('missing-dependency', 'Project dependencies are missing', `${subject}. Install the project's dependencies in its folder, then choose Retry Preview. RTL Analyzer does not install dependencies itself.`, install);
  }
  if (evidence.code === 'COMPANION_START_FAILED' || evidence.code === 'COMPANION_REQUEST_FAILED') {
    return make('companion-connection', 'The preview companion is unavailable', 'RTL Analyzer could not start or reach its local preview companion. Stop other RTL Analyzer runs, then choose Retry Preview.');
  }
  if (/Failed to compile|Failed to resolve import|SyntaxError|Transform failed|Build failed|\[vite\][^\n]*error/i.test(output)) {
    return make('compile-error', 'The dev server stopped on a build error', 'The dev server started but reported a compile or syntax error. Fix the error in the technical details (or run the startup script in a terminal), then choose Retry Preview.', `${runScript}`);
  }
  if (evidence.reason === 'timeout') {
    const port = evidence.port !== undefined ? ` on port ${evidence.port}` : '';
    const waited = evidence.waitedMs !== undefined ? ` within ${Math.round(evidence.waitedMs / 1000)} seconds` : ' within the startup window';
    return make('startup-timeout', 'The dev server did not respond in time', `The dev server did not respond as the expected application${port}${waited}. Check that the startup script serves that address, or raise startupTimeoutMs in rtl-preview.config.json, then choose Retry Preview.`);
  }
  if (evidence.reason === 'exited') {
    const detail = evidence.exitCode !== undefined && evidence.exitCode !== null ? `exit code ${evidence.exitCode}` : evidence.signal ? `signal ${evidence.signal}` : 'no exit code';
    return make('unexpected-exit', 'The dev server stopped unexpectedly', `The dev server exited (${detail}) before it was ready. Run the startup script yourself in the project folder to see its full output, fix the problem, then choose Retry Preview.`, runScript);
  }
  return make('unknown', "Couldn't start live preview", 'RTL Analyzer could not identify the cause from the evidence it has. Open technical details, or run the startup script yourself to see its output, then choose Retry Preview.', runScript);
}

/** Plain text for Copy Diagnostics. Built from the already-redacted record, so nothing extra is ever included. */
export function formatDiagnosticsForCopy(diagnostic: StartupDiagnostic): string {
  const t = diagnostic.technical;
  const lines = [
    'RTL Analyzer Live Preview diagnostics',
    `Category: ${diagnostic.category}`,
    `Code: ${diagnostic.code}`,
    `Title: ${diagnostic.title}`,
    ...(diagnostic.recovery ? [`Suggested command (run yourself): ${diagnostic.recovery}`] : []),
    ...(t.reason ? [`Reason: ${t.reason}`] : []),
    ...(t.exitCode !== undefined ? [`Exit code: ${t.exitCode === null ? 'none' : t.exitCode}`] : []),
    ...(t.signal ? [`Signal: ${t.signal}`] : []),
    ...(t.spawnErrorCode ? [`Spawn error: ${t.spawnErrorCode}`] : []),
    ...(t.command ? [`Command: ${t.command}${t.startupScript ? ' run ' + t.startupScript : ''}`] : []),
    ...(t.cwd ? [`Project folder: ${t.cwd}`] : []),
    ...(t.port !== undefined ? [`Port: ${t.port}`] : []),
    ...(t.waitedMs !== undefined ? [`Waited: ${Math.round(t.waitedMs / 100) / 10} s`] : []),
    '',
    'Output (redacted, most recent):',
    t.output || '(no output captured)',
  ];
  return lines.join('\n');
}

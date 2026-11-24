import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isDirectExecution, main, openDashboard, parseProjectScriptFlags, runDefaultDashboard, type DefaultDashboardOptions } from '../src/standalone-cli.js';
import type { CliIO } from '../src/cli.js';
import { discover } from '../src/discovery.js';
import type { PreviewEligibility } from '../src/preview-orchestrator.js';

function io() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return { stdout, stderr, io: { writeStdout: (value: string) => stdout.push(value), writeStderr: (value: string) => stderr.push(value) } satisfies CliIO };
}

function childProcess() {
  const child = new EventEmitter() as EventEmitter & { kill: () => boolean };
  child.kill = () => true;
  return child;
}

describe('standalone CLI defaults', () => {
  it('scans cwd into an external dashboard directory and preserves companion artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-cli-default-test-'));
    const tempRoot = await mkdtemp(join(tmpdir(), 'rtl-cli-default-output-'));
    const output = io();
    const opened: string[] = [];
    let args: string[] = [];
    const options: DefaultDashboardOptions = {
      io: output.io,
      run: async (nextArgs, nextIo) => {
        args = nextArgs;
        const outputDir = nextArgs[nextArgs.indexOf('--output-dir') + 1];
        await mkdir(outputDir, { recursive: true });
        await Promise.all(['rtl-report-dashboard.html', 'rtl-report.json', 'rtl-report.md', 'rtl-report-structured.md'].map(name => writeFile(join(outputDir, name), name)));
        nextIo.writeStderr('scan summary');
        return 0;
      },
      open: async path => { opened.push(path); return true; },
      tempRoot,
    };
    const code = await runDefaultDashboard(options);
    const outputDir = args[args.indexOf('--output-dir') + 1];
    expect(code).toBe(0);
    expect(outputDir).not.toContain(root);
    expect(outputDir).not.toBe(process.cwd());
    expect(opened).toEqual([join(outputDir, 'rtl-report-dashboard.html')]);
    expect(output.stderr).toContain('Dashboard: ' + join(outputDir, 'rtl-report-dashboard.html'));
  });

  it('fails clearly without a dashboard and preserves a scan finding exit code', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-cli-missing-dashboard-'));
    const missing = io();
    const missingCode = await runDefaultDashboard({ io: missing.io, tempRoot: root, run: async () => 0, open: async () => { throw new Error('browser must not launch'); } });
    expect(missingCode).toBe(2);
    expect(missing.stderr[0]).toMatch(/^Dashboard was not generated:/);

    const findings = io();
    const findingsCode = await runDefaultDashboard({
      io: findings.io,
      tempRoot: root,
      run: async args => {
        const outputDir = args[args.indexOf('--output-dir') + 1];
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'rtl-report-dashboard.html'), 'dashboard');
        return 1;
      },
      open: async () => false,
    });
    expect(findingsCode).toBe(1);
  });

  it('handles browser success, failure, and timeout without a real browser', async () => {
    const success = childProcess();
    const successPromise = openDashboard('/tmp/report.html', 'linux', () => success, 50);
    success.emit('close', 0);
    await expect(successPromise).resolves.toBe(true);

    const failure = childProcess();
    const failurePromise = openDashboard('/tmp/report.html', 'darwin', () => failure, 50);
    failure.emit('error', new Error('headless'));
    await expect(failurePromise).resolves.toBe(false);

    const timedOut = childProcess();
    let killed = false;
    timedOut.kill = () => { killed = true; return true; };
    await expect(openDashboard('/tmp/report.html', 'win32', () => timedOut, 5)).resolves.toBe(false);
    expect(killed).toBe(true);
  });

  it('keeps explicit scans browser-free and preserves ignored directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'rtl-cli-explicit-test-'));
    const outputDir = await mkdtemp(join(realpathSync(tmpdir()), 'rtl-cli-explicit-output-'));
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'node_modules', 'ignored'), { recursive: true });
    await writeFile(join(root, 'src', 'styles.css'), '.page { margin-left: 1px; }');
    await writeFile(join(root, 'node_modules', 'ignored', 'ignored.css'), '.page { margin-right: 2px; }');
    const discovered = await discover(root);
    expect(discovered.files).toEqual(['src/styles.css']);
    const output = io();
    expect(await main(['scan', root, '--format', 'dashboard', '--output-dir', outputDir], output.io)).toBe(0);
    expect(output.stderr.some(line => line.startsWith('Dashboard:'))).toBe(false);
  });

  it('preserves help and version command routing', async () => {
    const help = io();
    expect(await main(['--help'], help.io)).toBe(0);
    expect(help.stdout[0]).toContain('rtl-analyzer scan');
    const version = io();
    expect(await main(['--version'], version.io)).toBe(0);
    expect(version.stdout[0]).toMatch(/^\d+\.\d+\.\d+\n$/);
  });

  it('canonicalizes the npm-installed entry point before direct execution', async () => {
    const modulePath = fileURLToPath(import.meta.url);
    expect(isDirectExecution(modulePath.toUpperCase(), modulePath, 'win32')).toBe(true);
    expect(isDirectExecution(`${modulePath}.cmd`, modulePath, 'win32')).toBe(false);
    expect(isDirectExecution(null, modulePath, 'win32')).toBe(false);
  });
});

describe('default workflow preview consent (milestone 1)', () => {
  async function runWith(preview: NonNullable<DefaultDashboardOptions['preview']>, root = '/fixture') {
    const tempRoot = await mkdtemp(join(tmpdir(), 'rtl-cli-consent-output-'));
    const output = io();
    const opened: string[] = [];
    const seenArgs: string[][] = [];
    const code = await runDefaultDashboard({
      io: output.io,
      root,
      tempRoot,
      run: async args => {
        seenArgs.push(args);
        const outputDir = args[args.indexOf('--output-dir') + 1];
        await mkdir(outputDir, { recursive: true });
        await writeFile(join(outputDir, 'rtl-report-dashboard.html'), 'dashboard');
        return 0;
      },
      open: async path => { opened.push(path); return true; },
      preview: { dashboardPort: 0, ...preview },
    });
    return { code, output, opened, args: seenArgs[0] };
  }
  const eligible: PreviewEligibility = { eligible: true, applications: [], commands: ['npm run dev -- --port 4236'] };

  it('embeds source snippets in the default dashboard and keeps the static report when unsupported', async () => {
    const result = await runWith({ inspect: async () => ({ eligible: false, failure: { code: 'PREVIEW_CONFIGURATION_MISSING', message: 'No rtl-preview.config.json.' } }) });
    expect(result.code).toBe(0);
    expect(result.args).toContain('--embed-source-snippets');
    expect(result.output.stderr.join('\n')).toContain('Live Preview Unavailable: No rtl-preview.config.json.');
    expect(result.opened).toHaveLength(1);
  });

  it('keeps dashboard HTML off stdout and reports the report file path, even when non-interactive', async () => {
    const result = await runWith({ inspect: async () => eligible, interactive: false, optOut: true });
    expect(result.code).toBe(0);
    expect(result.output.stdout.join('')).not.toMatch(/<!doctype html>/i);
    expect(result.output.stderr.join('\n')).toMatch(/Dashboard: .*rtl-report-dashboard\.html/);
  });

  it('starts the dev server by default in an interactive terminal, without a flag or a prompt', async () => {
    const calls: string[] = [];
    const result = await runWith({
      inspect: async () => eligible,
      interactive: true,
      dependencies: async () => ({ ok: true }),
      start: async () => { calls.push('start'); return { state: 'ready', stop: async () => 'released' as const }; },
      waitForStop: async () => undefined,
    });
    expect(calls).toEqual(['start']);
    expect(result.output.stderr.join('\n')).toContain('RTL Analyzer is starting your project');
    expect(result.output.stderr.join('\n')).toContain('npm run dev -- --port 4236');
  });

  it('needs --approve-project-scripts in a non-interactive run, and starts nothing without it', async () => {
    let started = false;
    const result = await runWith({ inspect: async () => eligible, interactive: false, start: async () => { started = true; return { state: 'ready', stop: async () => 'released' as const }; } });
    expect(started).toBe(false);
    expect(result.output.stderr.join('\n')).toContain('non-interactive runs need explicit approval');
    expect(result.opened).toHaveLength(1);
  });

  it('prints the startup notice only after the dependency check passes, right before the dev server starts', async () => {
    const events: string[] = [];
    const stderr = (line: string) => events.push('notice:' + line.split('\n')[0]);
    const runNotice = (dependencies: () => Promise<{ ok: true } | { ok: false; failure: { code: string; message: string } }>) => {
      events.length = 0;
      return runDefaultDashboard({
        io: { writeStdout: () => undefined, writeStderr: stderr },
        root: '/fixture',
        tempRoot: tmpdir(),
        run: async args => {
          const outputDir = args[args.indexOf('--output-dir') + 1];
          await mkdir(outputDir, { recursive: true });
          await writeFile(join(outputDir, 'rtl-report-dashboard.html'), 'dashboard');
          return 0;
        },
        open: async () => true,
        preview: {
          interactive: true,
          dashboardPort: 0,
          inspect: async () => eligible,
          dependencies,
          start: async () => { events.push('start'); return { state: 'ready', stop: async () => 'released' as const }; },
          waitForStop: async () => undefined,
        },
      });
    };
    // Missing dependencies: no notice at all, and nothing starts.
    await runNotice(async () => ({ ok: false, failure: { code: 'PREVIEW_DEPENDENCIES_MISSING', message: 'missing' } }));
    expect(events.some(e => e.startsWith('notice:RTL Analyzer is starting'))).toBe(false);
    expect(events).not.toContain('start');
    // Dependencies installed: the notice comes first, immediately before the start.
    await runNotice(async () => ({ ok: true }));
    const noticeAt = events.findIndex(e => e.startsWith('notice:RTL Analyzer is starting'));
    expect(noticeAt).toBeGreaterThanOrEqual(0);
    expect(events[noticeAt + 1]).toBe('notice:  npm run dev -- --port 4236');
    expect(events.indexOf('start')).toBeGreaterThan(noticeAt);
  });

  it('runs nothing with --no-project-scripts and keeps the static report', async () => {
    let started = false;
    const result = await runWith({ inspect: async () => eligible, interactive: false, optOut: true, start: async () => { started = true; return { state: 'ready', stop: async () => 'released' as const }; } });
    expect(started).toBe(false);
    expect(result.output.stderr.join('\n')).toContain('Live preview not started: Live preview was disabled with --no-project-scripts.');
    expect(result.opened).toHaveLength(1);
  });

  it('reports missing dependencies as setup, never starts a companion, and keeps the static report', async () => {
    let started = false;
    const failure = { code: 'PREVIEW_DEPENDENCIES_MISSING', message: 'The project\'s dependencies are not installed: node_modules was not found.\nSuggested command (run it in the project folder): npm ci' };
    const result = await runWith({
      inspect: async () => eligible,
      interactive: false,
      authorized: true,
      dependencies: async () => ({ ok: false, failure }),
      start: async () => { started = true; return { state: 'ready', stop: async () => 'released' as const }; },
    });
    expect(started).toBe(false);
    expect(result.code).toBe(0);
    expect(result.output.stderr.join('\n')).toContain("Couldn't Start Live Preview: The project's dependencies are not installed");
    expect(result.output.stderr.join('\n')).toContain('Suggested command (run it in the project folder): npm ci');
    expect(result.opened).toHaveLength(1);
  });

  it('starts services after authorization and stops them when the user asks', async () => {
    const calls: string[] = [];
    const result = await runWith({
      inspect: async () => eligible,
      authorized: true,
      start: async options => { calls.push(options.companionEntry.split('/').pop()!); return { state: 'ready', stop: async () => { calls.push('stopped'); return 'released' as const; } }; },
      waitForStop: async () => { calls.push('stop-requested'); },
    });
    expect(calls).toEqual(['preview-cli.js', 'stop-requested', 'stopped']);
    expect(result.opened).toHaveLength(1);
    expect(result.opened[0]).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/rtl-report-dashboard\.html$/);
    expect(result.output.stderr.join('\n')).toMatch(/Live preview ready: http:\/\/127\.0\.0\.1:\d+\/rtl-report-dashboard\.html/);
  });

  it('falls back to the static report when services cannot start', async () => {
    let stopped = false;
    const result = await runWith({
      inspect: async () => eligible,
      authorized: true,
      start: async () => ({ state: 'startup_failed', failure: { code: 'PORT_CONFLICT_DASHBOARD', message: 'Port 4320 is in use.' }, stop: async () => { stopped = true; return 'not-held' as const; } }),
    });
    // A failed attempt has already released what it acquired, so the session has nothing left to stop.
    expect(stopped).toBe(false);
    expect(result.output.stderr.join('\n')).toContain("Couldn't Start Live Preview: Port 4320 is in use. The static report is available.");
    expect(result.opened).toHaveLength(1);
    expect(result.opened[0]).toMatch(/rtl-report-dashboard\.html$/);
  });

  it('reports a busy dashboard port with the earlier wording and starts nothing', async () => {
    const blocker = createServer();
    await new Promise<void>(resolve => blocker.listen(0, '127.0.0.1', () => resolve()));
    const port = (blocker.address() as { port: number }).port;
    let started = false;
    try {
      const result = await runWith({
        inspect: async () => eligible,
        authorized: true,
        dashboardPort: port,
        start: async () => { started = true; return { state: 'ready', stop: async () => 'released' as const }; },
      });
      expect(started).toBe(false);
      expect(result.output.stderr.join('\n')).toContain(`Couldn't Start Live Preview: Port ${port} is in use by another process. RTL Analyzer did not stop it; free the port and retry. The static report is available.`);
      expect(result.opened).toHaveLength(1);
    } finally {
      await new Promise<void>(resolve => blocker.close(() => resolve()));
    }
  });

  it('parses the compatibility flag, the opt-out, and rejects both together', () => {
    expect(parseProjectScriptFlags([])).toMatchObject({ isDefaultCommand: true, authorized: false, optOut: false });
    expect(parseProjectScriptFlags(['--approve-project-scripts'])).toMatchObject({ isDefaultCommand: true, authorized: true, optOut: false });
    expect(parseProjectScriptFlags(['--no-project-scripts'])).toMatchObject({ isDefaultCommand: true, authorized: false, optOut: true });
    expect(parseProjectScriptFlags(['--approve-project-scripts', '--no-project-scripts'])).toMatchObject({ isDefaultCommand: true, error: expect.stringContaining('cannot be used together') });
    // Flags on other commands keep the command's own argument handling.
    expect(parseProjectScriptFlags(['scan', '--no-project-scripts'])).toMatchObject({ isDefaultCommand: false, optOut: false });
  });
});

import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { main, openDashboard, runDefaultDashboard, type DefaultDashboardOptions } from '../src/standalone-cli.js';
import type { CliIO } from '../src/cli.js';
import { discover } from '../src/discovery.js';

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
});

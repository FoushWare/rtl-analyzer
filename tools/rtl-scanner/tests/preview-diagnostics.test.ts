import { describe, expect, it } from 'vitest';
import { classifyStartupFailure, formatDiagnosticsForCopy, installCommandFor, sanitizeDiagnosticText } from '../src/preview-diagnostics.js';

const HOME = '/Users/tester';

describe('startup failure classification', () => {
  it.each([
    ['missing executable reported by the shell', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 127, output: 'sh: vite: command not found' }, 'missing-dependency'],
    ['module not found in the dev script', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 1, output: "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite'" }, 'missing-dependency'],
    ['port already bound by the dev server', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 1, output: 'Error: listen EADDRINUSE: address already in use 127.0.0.1:4216' }, 'port-in-use'],
    ['occupied original port reported by the runtime', { code: 'ORIGINAL_PREVIEW_PORT_OCCUPIED', port: 4216 }, 'port-in-use'],
    ['companion port held by another process', { code: 'PORT_CONFLICT_COMPANION', port: 4318 }, 'port-in-use'],
    ['missing startup script', { code: 'PREVIEW_STARTUP_SCRIPT_MISSING' }, 'missing-script'],
    ['npm reporting a missing script', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 1, output: 'npm ERR! Missing script: "dev"' }, 'missing-script'],
    ['permission denied while starting', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 126, output: 'sh: ./node_modules/.bin/vite: Permission denied', spawnErrorCode: undefined }, 'permission'],
    ['package manager binary not found', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'spawn-error', spawnErrorCode: 'ENOENT', packageManager: 'pnpm' }, 'missing-dependency'],
    ['compile error while the dev server runs', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 1, output: '[vite] Internal server error: Failed to compile src/app.js' }, 'compile-error'],
    ['dev server alive but never identified', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'timeout', port: 4216, waitedMs: 10_000 }, 'startup-timeout'],
    ['dev server exited with a code', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 3, output: 'something unrelated' }, 'unexpected-exit'],
    ['companion did not become ready', { code: 'COMPANION_START_FAILED', reason: 'timeout', output: 'boot log' }, 'companion-connection'],
    ['no evidence at all', { code: 'ORIGINAL_PREVIEW_STARTUP_FAILED' }, 'unknown'],
  ] as const)('classifies %s as %s', (_label, evidence, category) => {
    expect(classifyStartupFailure({ ...evidence }, HOME).category).toBe(category);
  });

  it('never claims a missing dependency for a port conflict', () => {
    const diagnostic = classifyStartupFailure({ code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 1, output: 'Error: listen EADDRINUSE 127.0.0.1:4216' }, HOME);
    expect(diagnostic.category).toBe('port-in-use');
    expect(diagnostic.explanation).not.toMatch(/install/i);
    expect(diagnostic.recovery).toBeUndefined();
  });

  it('suggests the lockfile-matching install command as text only', () => {
    const diagnostic = classifyStartupFailure({ code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 127, output: 'sh: vite: command not found', packageManager: 'npm', installCommand: 'npm ci' }, HOME);
    expect(diagnostic.recovery).toBe('npm ci');
    expect(diagnostic.explanation).toContain('vite is not installed in this project');
  });

  it('keeps the port, exit code and script in the technical record', () => {
    const diagnostic = classifyStartupFailure({ code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 3, command: 'npm', startupScript: 'dev', cwd: '/Users/tester/project', port: 4216, output: 'boom' }, HOME);
    expect(diagnostic.technical).toMatchObject({ reason: 'exited', exitCode: 3, command: 'npm', startupScript: 'dev', cwd: '~/project', port: 4216, output: 'boom' });
  });
});

describe('sanitizeDiagnosticText', () => {
  it('masks credentials, bearer tokens and secret-named values', () => {
    const cleaned = sanitizeDiagnosticText([
      'proxy http://user:hunter2@registry.example.test/',
      'Authorization: Bearer abc.def.ghi',
      'NPM_TOKEN=npm_live_secret',
      'api_key = sk-123456',
      'token: plain-value',
      'ordinary line',
    ].join('\n'), HOME);
    for (const secret of ['hunter2', 'abc.def.ghi', 'npm_live_secret', 'sk-123456', 'plain-value']) expect(cleaned).not.toContain(secret);
    expect(cleaned).toContain('ordinary line');
  });

  it('removes escape sequences and control characters but keeps readable text', () => {
    expect(sanitizeDiagnosticText('\u001b[31mred\u001b[0m\u0007 text\u0000', HOME)).toBe('red text');
  });

  it('is bounded in lines, line length and total size', () => {
    const cleaned = sanitizeDiagnosticText(Array.from({ length: 200 }, (_, i) => `row ${i} ${'z'.repeat(800)}`).join('\n'), HOME);
    expect(cleaned.length).toBeLessThanOrEqual(2000);
    expect(cleaned.split('\n').length).toBeLessThanOrEqual(30);
    expect(cleaned.split('\n').every(line => line.length <= 300)).toBe(true);
  });

  it('is idempotent', () => {
    const once = sanitizeDiagnosticText('token=abc\nhome /Users/tester/x', HOME);
    expect(sanitizeDiagnosticText(once, HOME)).toBe(once);
  });
});

describe('Copy Diagnostics text', () => {
  it('contains the technical record and no environment values', () => {
    const diagnostic = classifyStartupFailure({ code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'exited', exitCode: 127, command: 'npm', startupScript: 'dev', cwd: '/Users/tester/project', port: 4216, output: 'sh: vite: command not found\nSECRET_TOKEN=leak' }, HOME);
    const text = formatDiagnosticsForCopy(diagnostic);
    expect(text).toContain('Category: missing-dependency');
    expect(text).toContain('Exit code: 127');
    expect(text).toContain('Command: npm run dev');
    expect(text).toContain('Project folder: ~/project');
    expect(text).not.toContain('leak');
    expect(text).not.toContain('SECRET_TOKEN');
  });

  it('chooses install commands per package manager and lockfile', () => {
    expect(installCommandFor('npm', 'package-lock.json')).toBe('npm ci');
    expect(installCommandFor('npm', undefined)).toBe('npm install');
    expect(installCommandFor('pnpm', 'pnpm-lock.yaml')).toBe('pnpm install --frozen-lockfile');
    expect(installCommandFor('yarn', 'yarn.lock')).toBe('yarn install --frozen-lockfile');
  });
});

describe('startup timeout wording', () => {
  it('states the measured wait instead of a generic window', () => {
    const diagnostic = classifyStartupFailure({ code: 'ORIGINAL_PREVIEW_STARTUP_FAILED', reason: 'timeout', port: 4216, waitedMs: 15_000 }, HOME);
    expect(diagnostic.category).toBe('startup-timeout');
    expect(diagnostic.explanation).toContain('within 15 seconds');
    expect(diagnostic.explanation).toContain('startupTimeoutMs');
  });
});

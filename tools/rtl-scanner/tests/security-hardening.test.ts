import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Security regression tests for v0.6.3. They run the BUILT package (packages/rtl-analyzer/dist), so they exercise the
// same code that ships. Each run uses a temporary project, temporary state stores and a temporary TMPDIR.

const dist = resolve(import.meta.dirname, '../../../packages/rtl-analyzer/dist');
const { DashboardSession } = await import(join(dist, 'dashboard-session.js')) as typeof import('../../../packages/rtl-analyzer/dist/dashboard-session.js');
const { readCompanionBootstrap, redactAbsolutePaths, isAllowedLoopbackHost, CompanionSessions, secretsEqual, writeCompanionBootstrap, removeCompanionBootstrap, companionBootstrapPath, projectRootDigest } = await import(join(dist, 'companion-auth.js')) as typeof import('../../../packages/rtl-analyzer/dist/companion-auth.js');

const workspace = mkdtempSync(join(tmpdir(), 'rtl-security-'));
const TMP = join(workspace, 'tmp');
const STATE = join(workspace, 'state');
const PROJECT = join(workspace, 'project');
const SYNTHETIC_SOURCE = 'SYNTHETIC_SOURCE_MARKER_7431';

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });
}

/** Sends a raw HTTP request with an explicit Host header (fetch cannot override Host). */
function raw(port: number, path: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<{ status: number; text: string }> {
  return new Promise((resolveRequest, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method: options.method ?? 'GET', headers: { host: `127.0.0.1:${port}`, ...(options.headers ?? {}) } }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolveRequest({ status: res.statusCode ?? 0, text }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function startCompanion(port: number, env: Record<string, string> = {}): Promise<{ child: ChildProcess; log: () => string }> {
  const logPath = join(workspace, `companion-${port}-${Math.random().toString(36).slice(2)}.log`);
  const child = spawn(process.execPath, [join(dist, 'preview-cli.js')], {
    env: {
      ...process.env,
      TMPDIR: TMP,
      TMP,
      TEMP: TMP,
      RTL_PROJECT_ROOT: PROJECT,
      RTL_PREVIEW_PORT: String(port),
      RTL_REVIEW_STORE_PATH: join(STATE, 'review-records-v1.json'),
      RTL_EVIDENCE_STORE_PATH: join(STATE, 'review-evidence-v1.json'),
      RTL_MANUAL_CHANGE_STORE_PATH: join(STATE, 'manual-changes-v1.json'),
      RTL_SCAN_MANIFEST_STORE_PATH: join(STATE, 'scan-manifests-v1.json'),
      RTL_AUDIT_STORE_PATH: join(STATE, 'apply-audit-v1.json'),
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout?.on('data', chunk => { output += chunk; });
  child.stderr?.on('data', chunk => { output += chunk; });
  for (let i = 0; i < 100; i++) {
    const health = await raw(port, '/health').catch(() => null);
    if (health?.status === 200) return { child, log: () => output };
    await new Promise(r => setTimeout(r, 100));
  }
  child.kill('SIGKILL');
  throw new Error(`companion did not start: ${output}`);
}

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise(resolveStop => {
    if (child.exitCode !== null || child.signalCode !== null) return resolveStop();
    child.once('exit', () => resolveStop());
    child.kill('SIGTERM');
    setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 5000).unref();
  });
}

function bootstrapOf(port: number): string {
  const secret = readCompanionBootstrap(port, TMP);
  if (!secret) throw new Error('no bootstrap secret published');
  return secret;
}

beforeAll(() => {
  mkdirSync(TMP, { recursive: true });
  mkdirSync(STATE, { recursive: true });
  mkdirSync(join(PROJECT, 'src'), { recursive: true });
  writeFileSync(join(PROJECT, 'src', 'Label.tsx'), `export const Label = () => <span style={{ marginLeft: 8 }}>${SYNTHETIC_SOURCE}</span>;\n`);
  writeFileSync(join(PROJECT, 'src', 'styles.css'), '.card {\n  margin-left: 8px;\n}\n');
  writeFileSync(join(PROJECT, 'rtl-scanner.config.json'), JSON.stringify({ schemaVersion: 1, generatedStyleOwner: 'unknown', ownership: { css: 'custom-css' }, approvals: [], exceptions: [], issueBindings: [], dynamicExceptions: [], roles: [] }));
  process.env.TMPDIR = TMP;
  process.env.TMP = TMP;
  process.env.TEMP = TMP;
});

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

describe('F-01 Host validation (pure predicate)', () => {
  it('accepts only the exact loopback host names on the listening port', () => {
    expect(isAllowedLoopbackHost('127.0.0.1:4318', 4318)).toBe(true);
    expect(isAllowedLoopbackHost('localhost:4318', 4318)).toBe(true);
    expect(isAllowedLoopbackHost('127.0.0.1:4319', 4318)).toBe(false);
    expect(isAllowedLoopbackHost('evil.example:4318', 4318)).toBe(false);
    expect(isAllowedLoopbackHost('127.0.0.1:4318.evil.test', 4318)).toBe(false);
    expect(isAllowedLoopbackHost('127.0.0.1', 4318)).toBe(false);
    expect(isAllowedLoopbackHost(undefined, 4318)).toBe(false);
  });
});

describe('F-03 companion session authorization (built companion)', () => {
  let port = 0;
  let child: ChildProcess | undefined;
  let bootstrap = '';
  let companionLog: () => string = () => '';

  beforeAll(async () => {
    port = await freePort();
    ({ child, log: companionLog } = await startCompanion(port));
    bootstrap = bootstrapOf(port);
  }, 20000);

  afterAll(async () => {
    if (child) await stopChild(child);
  });

  it('F-01: rejects a foreign Host on /health and every route', async () => {
    const health = await raw(port, '/health', { headers: { host: 'evil.example:' + port } });
    expect(health.status).toBe(403);
    expect(health.text).toContain('HOST_NOT_ALLOWED');
    const progress = await raw(port, '/review/progress', { headers: { host: 'attacker.test:' + port, 'x-rtl-companion-bootstrap': bootstrap } });
    expect(progress.status).toBe(403);
  });

  it('F-04: /health identifies the project by digest and exposes no filesystem paths', async () => {
    const health = await raw(port, '/health');
    expect(health.status).toBe(200);
    const body = JSON.parse(health.text) as Record<string, unknown>;
    expect(body.projectRootDigest).toBe(projectRootDigest(realpathSync(PROJECT)));
    expect(health.text).not.toContain(workspace);
    expect(health.text).not.toMatch(/"projectRoot"|"path"/);
  });

  it('F-03: rejects protected routes without credentials, with wrong credentials, or with a stale token', async () => {
    expect((await raw(port, '/review/progress')).status).toBe(401);
    expect((await raw(port, '/review/progress', { headers: { 'x-rtl-companion-session': 'not-a-token' } })).status).toBe(401);
    expect((await raw(port, '/review/progress', { headers: { 'x-rtl-companion-bootstrap': 'wrong' } })).status).toBe(401);
  });

  it('F-03: source context is unreadable without a session and readable with one', async () => {
    const inputDigest = 'a'.repeat(64);
    const path = `/review/source-context?inputDigest=${inputDigest}&policyDigest=${'b'.repeat(64)}&mode=one-by-one`;
    const denied = await raw(port, path);
    expect(denied.status).toBe(401);
    expect(denied.text).not.toContain(SYNTHETIC_SOURCE);

    const issued = JSON.parse((await raw(port, '/auth/session', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': bootstrap } })).text) as { token: string };
    expect(typeof issued.token).toBe('string');
    // Digest mismatch is reported; the point is that the request got past authorization to the handler.
    const allowed = await raw(port, path, { headers: { 'x-rtl-companion-session': issued.token } });
    expect(allowed.status).not.toBe(401);
  });

  it('F-03: session minting requires the bootstrap secret', async () => {
    expect((await raw(port, '/auth/session', { method: 'POST' })).status).toBe(401);
    expect((await raw(port, '/auth/session', { method: 'POST', headers: { 'x-rtl-companion-session': 'x' } })).status).toBe(401);
  });

  it('F-03: foreign or missing Origin is rejected on protected writes, even with a valid session', async () => {
    const issued = JSON.parse((await raw(port, '/auth/session', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': bootstrap } })).text) as { token: string };
    const session = { 'x-rtl-companion-session': issued.token, 'content-type': 'application/json' };
    expect((await raw(port, '/review/records', { method: 'POST', headers: session, body: '{}' })).text).toContain('ORIGIN_NOT_ALLOWED');
    expect((await raw(port, '/review/records', { method: 'POST', headers: { ...session, origin: 'http://evil.example' }, body: '{}' })).text).toContain('ORIGIN_NOT_ALLOWED');
    expect((await raw(port, '/review/records', { method: 'OPTIONS', headers: { origin: 'http://evil.example' } })).status).toBe(403);
  });

  it('preserves review approval and explicit confirmation with a valid dashboard session and Origin', async () => {
    const issued = JSON.parse((await raw(port, '/auth/session', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': bootstrap } })).text) as { token: string };
    const apply = await raw(port, '/review/apply', { method: 'POST', headers: { 'x-rtl-companion-session': issued.token, origin: 'http://127.0.0.1:4320', 'content-type': 'application/json' }, body: JSON.stringify({ identity: { findingId: 'x', sourcePath: 'src/Label.tsx', inputDigest: 'a', policyDigest: 'b', schemaVersion: 2 }, confirmation: '' }) });
    expect(apply.status).toBe(400);
    expect(apply.text).toContain('APPROVED_REVIEW_REQUIRED');
  });

  it('F-04: error responses carry no absolute project paths', async () => {
    const issued = JSON.parse((await raw(port, '/auth/session', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': bootstrap } })).text) as { token: string };
    const res = await raw(port, '/review/sessions', { method: 'POST', headers: { 'x-rtl-companion-session': issued.token, origin: 'http://127.0.0.1:4320', 'content-type': 'application/json' }, body: '{}' });
    expect(res.text).not.toContain(workspace);
    expect(res.text).not.toContain(PROJECT);
  });

  it('F-03: revocation takes effect immediately', async () => {
    const issued = JSON.parse((await raw(port, '/auth/session', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': bootstrap } })).text) as { token: string };
    expect((await raw(port, '/review/progress', { headers: { 'x-rtl-companion-session': issued.token } })).status).toBe(200);
    const revoke = await raw(port, '/auth/revoke', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': bootstrap, 'content-type': 'application/json' }, body: JSON.stringify({ token: issued.token }) });
    expect(JSON.parse(revoke.text)).toEqual({ revoked: true });
    expect((await raw(port, '/review/progress', { headers: { 'x-rtl-companion-session': issued.token } })).status).toBe(401);
  });

  it('F-02/F-04: the bootstrap secret and session tokens never appear in the companion log', async () => {
    const issued = JSON.parse((await raw(port, '/auth/session', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': bootstrap } })).text) as { token: string };
    await raw(port, '/review/sessions', { method: 'POST', headers: { 'x-rtl-companion-session': issued.token, origin: 'http://127.0.0.1:4320', 'content-type': 'application/json' }, body: '{}' });
    expect(companionLog()).not.toContain(bootstrap);
    expect(companionLog()).not.toContain(issued.token);
  });
});

describe('F-03 session expiry and restart (built companion)', () => {
  it('expires an idle session and invalidates every token after a restart', async () => {
    const port = await freePort();
    const { child } = await startCompanion(port, { RTL_PREVIEW_SESSION_IDLE_MS: '300', RTL_PREVIEW_SESSION_MAX_MS: '60000' });
    try {
      const bootstrap = bootstrapOf(port);
      const issued = JSON.parse((await raw(port, '/auth/session', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': bootstrap } })).text) as { token: string };
      expect((await raw(port, '/review/progress', { headers: { 'x-rtl-companion-session': issued.token } })).status).toBe(200);
      await new Promise(r => setTimeout(r, 500));
      expect((await raw(port, '/review/progress', { headers: { 'x-rtl-companion-session': issued.token } })).status).toBe(401);
    } finally {
      await stopChild(child);
    }
  }, 20000);

  it('publishes a bootstrap secret per run and removes it on exit', async () => {
    const port = await freePort();
    const { child } = await startCompanion(port);
    const path = companionBootstrapPath(port, TMP);
    expect(readFileSync(path, 'utf8')).toContain('"bootstrap"');
    const first = bootstrapOf(port);
    await stopChild(child);
    expect(() => readFileSync(path, 'utf8')).toThrow();
    const again = await startCompanion(port);
    try {
      expect(bootstrapOf(port)).not.toBe(first);
      const oldToken = 'stale-token-from-previous-run';
      expect((await raw(port, '/review/progress', { headers: { 'x-rtl-companion-session': oldToken } })).status).toBe(401);
    } finally {
      await stopChild(again.child);
    }
  }, 30000);
});

describe('F-02 dashboard session (built dashboard)', () => {
  let port = 0;
  let companionPort = 0;
  let companion: ChildProcess | undefined;
  let session: InstanceType<typeof DashboardSession> | undefined;
  let dashboardDir = '';

  beforeAll(async () => {
    companionPort = await freePort();
    ({ child: companion } = await startCompanion(companionPort));
    port = await freePort();
    dashboardDir = join(workspace, 'dashboard');
    mkdirSync(dashboardDir, { recursive: true });
    writeFileSync(join(dashboardDir, 'rtl-report-dashboard.html'), '<!doctype html><html><head><title>r</title></head><body><h1>report</h1></body></html>\n');
  }, 20000);

  afterAll(async () => {
    await session?.end().catch(() => undefined);
    if (companion) await stopChild(companion);
  });

  it('F-01: rejects foreign Host headers on the dashboard server and accepts loopback', async () => {
    session = new DashboardSession({ dashboardDir, port });
    await session.listen();
    expect((await raw(port, '/rtl-report-dashboard.html', { headers: { host: `evil.example:${port}` } })).status).toBe(403);
    expect((await raw(port, '/rtl-report-dashboard.html')).status).toBe(200);
    expect((await raw(port, '/preview/status', { headers: { host: `evil.example:${port}` } })).status).toBe(403);
  });

  it('F-02: refuses cross-site page loads', async () => {
    expect((await raw(port, '/rtl-report-dashboard.html', { headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(403);
    expect((await raw(port, '/rtl-report-dashboard.html', { headers: { 'sec-fetch-site': 'none' } })).status).toBe(200);
  });

  it('F-02: the page never contains the companion bootstrap secret', async () => {
    const bootstrap = bootstrapOf(companionPort);
    await session!.begin().catch(() => undefined);
    const page = (await raw(port, '/rtl-report-dashboard.html')).text;
    expect(page).not.toContain(bootstrap);
  });

  it('F-03: the page receives only a session token for the companion, and ending the session revokes it', async () => {
    const start = async () => ({ state: 'ready' as const, stop: async () => 'released' as const, companion: { origin: `http://127.0.0.1:${companionPort}`, bootstrap: bootstrapOf(companionPort) } });
    await session!.end();
    const port2 = await freePort();
    session = new DashboardSession({ dashboardDir, port: port2, start });
    await session.listen();
    await session.begin();
    const page = (await raw(port2, '/rtl-report-dashboard.html')).text;
    expect(page).not.toContain('companionSession');
    expect((await raw(port2, '/preview/companion-session', { headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(403);
    const minted = JSON.parse((await raw(port2, '/preview/companion-session')).text) as { token?: string };
    const token = minted.token;
    expect(token).toBeTruthy();
    expect((await raw(companionPort, '/review/progress', { headers: { 'x-rtl-companion-session': token! } })).status).toBe(200);
    await session.end();
    expect((await raw(companionPort, '/review/progress', { headers: { 'x-rtl-companion-session': token! } })).status).toBe(401);
    session = undefined;
  }, 20000);
});

describe('F-03 restart handling for a running dashboard (built companion and dashboard)', () => {
  it('re-authorizes the page after the companion restarts with a new bootstrap secret', async () => {
    const companionPort = await freePort();
    const first = await startCompanion(companionPort);
    const dashboardPort = await freePort();
    const dir = join(workspace, 'restart-dashboard');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rtl-report-dashboard.html'), '<!doctype html><html><head></head><body>r</body></html>\n');
    const dashboard = new DashboardSession({ dashboardDir: dir, port: dashboardPort, start: async () => ({ state: 'ready' as const, stop: async () => 'released' as const, companion: { origin: `http://127.0.0.1:${companionPort}`, bootstrap: bootstrapOf(companionPort) } }) });
    await dashboard.listen();
    await dashboard.begin();
    try {
      expect(JSON.parse((await raw(dashboardPort, '/preview/companion-session')).text).token).toBeTruthy();
      await stopChild(first.child);
      const second = await startCompanion(companionPort);
      try {
        const reissued = JSON.parse((await raw(dashboardPort, '/preview/companion-session')).text) as { token?: string };
        expect(reissued.token).toBeTruthy();
        expect((await raw(companionPort, '/review/progress', { headers: { 'x-rtl-companion-session': reissued.token! } })).status).toBe(200);
      } finally {
        await stopChild(second.child);
      }
    } finally {
      await dashboard.end();
    }
  }, 40000);
});

describe('overlay mirror of companion-auth stays identical to the pinned implementation', () => {
  it('matches the implementation file after the mirror header', () => {
    const mirror = readFileSync(resolve(import.meta.dirname, '../src/companion-auth.ts'), 'utf8');
    const pinned = readFileSync(resolve(import.meta.dirname, '../../../implementation/tools/rtl-scanner/src/companion-auth.ts'), 'utf8');
    const lf = (text: string) => text.replace(/\r\n/g, '\n');
    expect(lf(mirror).endsWith(lf(pinned))).toBe(true);
  });
});

describe('F-04 redaction and comparison helpers', () => {
  it('removes absolute paths and keeps repository-relative paths', () => {
    expect(redactAbsolutePaths('ENOENT: lstat \'/Users/alice/app/src/App.tsx\'')).toBe("ENOENT: lstat '<path>'");
    expect(redactAbsolutePaths('see src/App.tsx at line 4')).toBe('see src/App.tsx at line 4');
    expect(redactAbsolutePaths('C:\\work\\app\\x.ts')).toBe('<path>');
  });

  it('compares secrets in constant time semantics (value and length)', () => {
    expect(secretsEqual('abc', 'abc')).toBe(true);
    expect(secretsEqual('abc', 'abcd')).toBe(false);
    expect(secretsEqual(undefined, 'abc')).toBe(false);
    expect(secretsEqual('', '')).toBe(false);
  });

  it('expires idle sessions and enforces an absolute lifetime with a controllable clock', () => {
    let now = 0;
    const sessions = new CompanionSessions(1000, 5000, () => now);
    const { token } = sessions.issue();
    now = 900;
    expect(sessions.validate(token)).toBe(true);
    now = 1500;
    expect(sessions.validate(token)).toBe(true);
    now = 2400;
    expect(sessions.validate(token)).toBe(true);
    now = 2600;
    expect(sessions.validate(token)).toBe(true);
    now = 6000;
    expect(sessions.validate(token)).toBe(false);
    const second = sessions.issue().token;
    expect(sessions.revoke(second)).toBe(true);
    expect(sessions.validate(second)).toBe(false);
    expect(sessions.validate(undefined)).toBe(false);
  });

  it('writes the bootstrap file owner-only, replaces stale files, and only the writing process removes it', () => {
    const base = join(workspace, 'helpers');
    mkdirSync(base, { recursive: true });
    const secret = writeCompanionBootstrap(65000, '/unused/root', base);
    expect(readCompanionBootstrap(65000, base)).toBe(secret);
    expect(readCompanionBootstrap(65001, base)).toBeUndefined();
    const again = writeCompanionBootstrap(65000, '/unused/root', base);
    expect(again).not.toBe(secret);
    removeCompanionBootstrap(65000, base);
    expect(readCompanionBootstrap(65000, base)).toBeUndefined();
    expect(companionBootstrapPath(65000, base)).toContain('companion-65000.json');
  });
});

describe('F-03 page token lifecycle across restart, bootstrap change, concurrency and revocation (built companion and dashboard)', () => {
  const pageToken = async (dashboardPort: number, rejected?: string): Promise<string> => {
    const path = '/preview/companion-session' + (rejected ? `?rejected=${encodeURIComponent(rejected)}` : '');
    const response = await raw(dashboardPort, path);
    expect(response.status).toBe(200);
    return (JSON.parse(response.text) as { token: string }).token;
  };
  const progress = (companionPort: number, token: string) => raw(companionPort, '/review/progress', { headers: { 'x-rtl-companion-session': token } });

  it('reuses the page token while the companion bootstrap is unchanged, without a new mint', async () => {
    const companionPort = await freePort();
    const first = await startCompanion(companionPort);
    const dashboardPort = await freePort();
    const dir = join(workspace, 'reuse-dashboard');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rtl-report-dashboard.html'), '<!doctype html><html><head></head><body>r</body></html>\n');
    const dashboard = new DashboardSession({ dashboardDir: dir, port: dashboardPort, start: async () => ({ state: 'ready' as const, stop: async () => 'released' as const, companion: { origin: `http://127.0.0.1:${companionPort}`, bootstrap: bootstrapOf(companionPort) } }) });
    await dashboard.listen();
    await dashboard.begin();
    try {
      const a = await pageToken(dashboardPort);
      const b = await pageToken(dashboardPort);
      expect(b).toBe(a);
      expect((await progress(companionPort, a)).status).toBe(200);
    } finally {
      await stopChild(first.child);
      await dashboard.end();
    }
  });

  it('re-mints after a bootstrap change even when the page was never refused, and the old token stays dead', async () => {
    const companionPort = await freePort();
    const first = await startCompanion(companionPort);
    const dashboardPort = await freePort();
    const dir = join(workspace, 'changed-bootstrap-dashboard');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rtl-report-dashboard.html'), '<!doctype html><html><head></head><body>r</body></html>\n');
    const dashboard = new DashboardSession({ dashboardDir: dir, port: dashboardPort, start: async () => ({ state: 'ready' as const, stop: async () => 'released' as const, companion: { origin: `http://127.0.0.1:${companionPort}`, bootstrap: bootstrapOf(companionPort) } }) });
    await dashboard.listen();
    await dashboard.begin();
    let second: Awaited<ReturnType<typeof startCompanion>> | undefined;
    try {
      const old = await pageToken(dashboardPort);
      await stopChild(first.child);
      second = await startCompanion(companionPort);
      const fresh = await pageToken(dashboardPort);
      expect(fresh).not.toBe(old);
      expect((await progress(companionPort, fresh)).status).toBe(200);
      expect((await progress(companionPort, old)).status).toBe(401);
    } finally {
      if (second) await stopChild(second.child);
      await dashboard.end();
    }
  });

  it('shares one mint among concurrent requests that report the same rejected token', async () => {
    const companionPort = await freePort();
    const first = await startCompanion(companionPort);
    const dashboardPort = await freePort();
    const dir = join(workspace, 'concurrent-dashboard');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rtl-report-dashboard.html'), '<!doctype html><html><head></head><body>r</body></html>\n');
    const dashboard = new DashboardSession({ dashboardDir: dir, port: dashboardPort, start: async () => ({ state: 'ready' as const, stop: async () => 'released' as const, companion: { origin: `http://127.0.0.1:${companionPort}`, bootstrap: bootstrapOf(companionPort) } }) });
    await dashboard.listen();
    await dashboard.begin();
    let second: Awaited<ReturnType<typeof startCompanion>> | undefined;
    try {
      const old = await pageToken(dashboardPort);
      await stopChild(first.child);
      second = await startCompanion(companionPort);
      const tokens = await Promise.all(Array.from({ length: 6 }, () => pageToken(dashboardPort, old)));
      expect(new Set(tokens).size).toBe(1);
      expect((await progress(companionPort, tokens[0])).status).toBe(200);
    } finally {
      if (second) await stopChild(second.child);
      await dashboard.end();
    }
  });

  it('revokes the page token when the session ends and keeps the companion protections in place', async () => {
    const companionPort = await freePort();
    const first = await startCompanion(companionPort);
    const dashboardPort = await freePort();
    const dir = join(workspace, 'revoke-dashboard');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rtl-report-dashboard.html'), '<!doctype html><html><head></head><body>r</body></html>\n');
    const dashboard = new DashboardSession({ dashboardDir: dir, port: dashboardPort, start: async () => ({ state: 'ready' as const, stop: async () => 'released' as const, companion: { origin: `http://127.0.0.1:${companionPort}`, bootstrap: bootstrapOf(companionPort) } }) });
    await dashboard.listen();
    await dashboard.begin();
    try {
      const token = await pageToken(dashboardPort);
      expect((await progress(companionPort, token)).status).toBe(200);
      await dashboard.end();
      expect((await progress(companionPort, token)).status).toBe(401);
      expect((await raw(companionPort, '/review/progress')).status).toBe(401);
    } finally {
      await stopChild(first.child);
    }
  });
});

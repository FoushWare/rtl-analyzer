import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DashboardSession } from '../src/dashboard-session.js';
import type { ServiceResult } from '../src/preview-services.js';

const PAGE = '<!doctype html><html><body><main>report</main></body></html>';

async function outputDir() {
  const dir = await mkdtemp(join(tmpdir(), 'rtl-session-'));
  await writeFile(join(dir, 'rtl-report-dashboard.html'), PAGE);
  return dir;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

async function session(start?: (signal: AbortSignal) => Promise<ServiceResult>) {
  const s = new DashboardSession({ dashboardDir: await outputDir(), start, port: 0 });
  await s.listen();
  return s;
}

/** Reads the per-run secret the page is given, as the page itself would. */
async function secretOf(s: DashboardSession): Promise<string> {
  const html = await (await fetch(s.url)).text();
  const match = /window\.__RTL_PREVIEW_SESSION__=(\{.*?\});<\/script>/.exec(html);
  if (!match) throw new Error('no session config in page');
  return JSON.parse(match[1]).secret as string;
}

async function act(s: DashboardSession, path: string, headers: Record<string, string> = {}) {
  const origin = `http://127.0.0.1:${new URL(s.url).port}`;
  const response = await fetch(`${origin}${path}`, { method: 'POST', headers: { origin, ...headers } });
  return { status: response.status, body: await response.json() as { state?: string; error?: string } };
}

const ready = (stop: () => Promise<'released' | 'not-held' | 'release-failed'>): ServiceResult => ({ state: 'ready', stop });
const failed = (code: string, stop = async () => 'not-held' as const): ServiceResult => ({ state: 'startup_failed', failure: { code, message: `${code} happened` }, stop });

describe('dashboard session page', () => {
  it('serves the report with controls injected, and leaves the report file on disk unchanged', async () => {
    const dir = await outputDir();
    const s = new DashboardSession({ dashboardDir: dir, port: 0 });
    await s.listen();
    const html = await (await fetch(s.url)).text();
    expect(html).toContain('id="rtl-review-end"');
    expect(html).toContain('id="rtl-preview-dialog"');
    expect(html).toContain('window.__RTL_PREVIEW_SESSION__=');
    expect(await readFile(join(dir, 'rtl-report-dashboard.html'), 'utf8')).toBe(PAGE);
    await s.end();
  });

  it('places the status bar in page flow at the top of the body, never as a fixed overlay over review actions', async () => {
    const s = new DashboardSession({ dashboardDir: await outputDir(), port: 0 });
    await s.listen();
    try {
      const html = await (await fetch(s.url)).text();
      const bar = html.indexOf('id="rtl-preview-bar"');
      expect(bar).toBeGreaterThan(html.indexOf('<body'));
      expect(bar).toBeLessThan(html.indexOf('<main>'));
      expect(html).not.toMatch(/\.rtl-preview-bar\{[^}]*position:fixed/);
    } finally {
      await s.end();
    }
  });

  it('escapes status text so it cannot close the config script', async () => {
    const dir = await outputDir();
    const s = new DashboardSession({ dashboardDir: dir, port: 0 });
    s.setInitial('unsupported', { code: 'X', message: '</script><script>alert(1)</script>' });
    await s.listen();
    const html = await (await fetch(s.url)).text();
    expect(html).not.toContain('</script><script>alert(1)');
    await s.end();
  });

  it('reports the status without exposing the session secret', async () => {
    const s = await session();
    const status = await (await fetch(`http://127.0.0.1:${new URL(s.url).port}/preview/status`)).json();
    expect(status).toEqual({ state: 'static' });
    await s.end();
  });

  it('fails to listen when the port is taken', async () => {
    const blocker = createServer();
    await new Promise<void>(resolve => blocker.listen(0, '127.0.0.1', () => resolve()));
    const port = (blocker.address() as { port: number }).port;
    const s = new DashboardSession({ dashboardDir: await outputDir(), port });
    await expect(s.listen()).rejects.toThrow();
    await new Promise<void>(resolve => blocker.close(() => resolve()));
  });
});

describe('dashboard session actions', () => {
  it('rejects actions without the session secret or from another origin', async () => {
    const s = await session();
    const port = new URL(s.url).port;
    const noSecret = await act(s, '/preview/continue');
    expect(noSecret.status).toBe(403);
    const wrongOrigin = await fetch(`http://127.0.0.1:${port}/preview/continue`, { method: 'POST', headers: { origin: 'http://evil.test', 'x-rtl-session': await secretOf(s) } });
    expect(wrongOrigin.status).toBe(403);
    await s.end();
  });

  it('runs startup in the background and shows ready after a successful attempt', async () => {
    const attempt = deferred<ServiceResult>();
    const s = await session(() => attempt.promise);
    s.begin();
    expect(s.status().state).toBe('starting');
    attempt.resolve(ready(async () => 'released'));
    await s.begin();
    expect(s.status().state).toBe('ready');
    await s.end();
  });

  it('retry runs a new attempt only after a failed startup, and never stacks attempts', async () => {
    let calls = 0;
    const s = await session(async () => (++calls === 1 ? failed('COMPANION_START_FAILED') : ready(async () => 'released')));
    await s.begin();
    expect(s.status().state).toBe('startup_failed');
    const retry = await act(s, '/preview/retry', { 'x-rtl-session': await secretOf(s) });
    expect(retry.status).toBe(202);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(s.status().state).toBe('ready');
    expect(calls).toBe(2);
    const again = await act(s, '/preview/retry', { 'x-rtl-session': await secretOf(s) });
    expect(again.status).toBe(409);
    await s.end();
  });

  it('cancel during startup aborts the attempt and releases its lease when it lands', async () => {
    const attempt = deferred<ServiceResult>();
    let released = false;
    let aborted = false;
    const s = await session(signal => { signal.addEventListener('abort', () => { aborted = true; }); return attempt.promise; });
    s.begin();
    const cancel = await act(s, '/preview/cancel', { 'x-rtl-session': await secretOf(s) });
    expect(cancel.body.state).toBe('static');
    expect(aborted).toBe(true);
    attempt.resolve(ready(async () => { released = true; return 'released'; }));
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(released).toBe(true);
    expect(s.status().state).toBe('static');
    await s.end();
  });

  it('continue keeps the static report and does not touch a ready session', async () => {
    const s = await session(async () => failed('PREVIEW_NO_MAPPED_FINDINGS'));
    await s.begin();
    expect((await act(s, '/preview/continue', { 'x-rtl-session': await secretOf(s) })).body.state).toBe('static');
    s.setInitial('unsupported', { code: 'PREVIEW_CONFIGURATION_MISSING', message: 'none' });
    expect((await act(s, '/preview/continue', { 'x-rtl-session': await secretOf(s) })).body.state).toBe('static');
    await s.end();
  });

  it('end releases only this run’s lease, closes the server, and is safe to repeat', async () => {
    let releases = 0;
    const s = await session(async () => ready(async () => { releases += 1; return 'released'; }));
    await s.begin();
    const end = await act(s, '/preview/end', { 'x-rtl-session': await secretOf(s) });
    expect(end.body.state).toBe('ended');
    await s.waitForEnd();
    expect(releases).toBe(1);
    await s.end();
    expect(releases).toBe(1);
    await expect(fetch(s.url)).rejects.toThrow();
  });

  it('end while startup is in flight waits for it and releases what it acquired', async () => {
    const attempt = deferred<ServiceResult>();
    let released = false;
    const s = await session(() => attempt.promise);
    s.begin();
    const ending = s.end();
    attempt.resolve(ready(async () => { released = true; return 'released'; }));
    await ending;
    expect(released).toBe(true);
    expect(s.status().state).toBe('ended');
  });

  it('unknown preview routes are rejected', async () => {
    const s = await session();
    const result = await act(s, '/preview/nope', { 'x-rtl-session': await secretOf(s) });
    expect(result.status).toBe(404);
    await s.end();
  });
});

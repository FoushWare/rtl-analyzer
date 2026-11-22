import { spawn, type ChildProcess } from 'node:child_process';
import { openSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import type { PreviewFailure, PreviewState } from './preview-orchestrator.js';

// Milestone 2: orchestrates the existing packaged preview companion. All preview runtime logic (original
// dev-server start, identity checks, ownership and cleanup) stays inside the pinned implementation; this module
// only starts it as a process, waits on its HTTP API, and serves the generated dashboard.

export const COMPANION_PORT = 4318;
export const DASHBOARD_PORT = 4320;
export const DASHBOARD_FILE = 'rtl-report-dashboard.html';
const DASHBOARD_ORIGIN = `http://127.0.0.1:${DASHBOARD_PORT}`;
const COMPANION_ORIGIN = `http://127.0.0.1:${COMPANION_PORT}`;
const COMPANION_READY_TIMEOUT_MS = 15_000;
const ORIGINAL_START_TIMEOUT_MS = 30_000;
const MAX_MAPPING_PROBES = 25;
const COMPANION_LOG = 'preview-companion.log';
const COMPANION_STDERR_TAIL = 2000;

/**
 * `released`: this run's lease was released (the companion stops the original when no other session holds one).
 * `not-held`: this run never obtained a lease, so there was nothing to release.
 * `release-failed`: the companion did not confirm the release; the original may still be running.
 */
export type ReleaseOutcome = 'released' | 'not-held' | 'release-failed';

export type ServiceResult =
  | { readonly state: 'ready'; readonly dashboardUrl: string; readonly stop: () => Promise<ReleaseOutcome> }
  | { readonly state: Exclude<PreviewState, 'ready' | 'starting'>; readonly failure: PreviewFailure; readonly stop: () => Promise<ReleaseOutcome> };

/** Fields this module reads from companion responses; each is checked before use. */
export interface CompanionBody {
  readonly route?: unknown;
  readonly error?: unknown;
  readonly original?: { readonly available?: unknown; readonly reason?: unknown };
  readonly originalLease?: { readonly application?: unknown; readonly token?: unknown };
}

export interface ServiceDependencies {
  readonly probePort?: (port: number) => Promise<boolean>;
  readonly health?: (origin: string) => Promise<Record<string, unknown> | null>;
  readonly spawnCompanion?: (root: string, entry: string, logPath: string) => ChildProcess;
  readonly fetchJson?: (url: string, init?: RequestInit) => Promise<{ status: number; body: CompanionBody }>;
}

export interface ServiceOptions {
  /** Absolute project root; must be the same root the scan used. */
  readonly root: string;
  /** Path to the `rtl-report.json` written by the scan in the same output directory. */
  readonly reportPath: string;
  /** Directory that contains the generated dashboard HTML. */
  readonly dashboardDir: string;
  /** Path to the packaged companion entry (`dist/preview-cli.js`). */
  readonly companionEntry: string;
  readonly log?: (line: string) => void;
  /** Aborting (Ctrl-C during startup) releases this run's lease and reports `CANCELLED`. The CLI never signals the companion. */
  readonly signal?: AbortSignal;
}

/** True when nothing listens on the loopback port. Any listener, including one of ours, counts as occupied. */
export function probeLoopbackPort(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const probe = createNetServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}

async function healthOf(origin: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) });
    if (!response.ok) return null;
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchJsonDefault(url: string, init?: RequestInit): Promise<{ status: number; body: CompanionBody }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(ORIGINAL_START_TIMEOUT_MS) });
  return { status: response.status, body: (await response.json().catch(() => ({}))) as CompanionBody };
}

function failure(code: string, message: string): PreviewFailure {
  return { code, message };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Serves only the generated dashboard file; every other path is 404. */
function serveDashboard(dashboardDir: string): Server {
  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== 'GET' || request.url?.split('?')[0] !== `/${DASHBOARD_FILE}`) {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    try {
      const html = await readFile(`${dashboardDir}/${DASHBOARD_FILE}`);
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    }
  });
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(DASHBOARD_PORT, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
  });
}

function close(server: Server): Promise<void> {
  return new Promise(resolve => server.close(() => resolve()));
}

/**
 * Starts (or reuses) the companion, serves the dashboard, and proves readiness:
 * companion health for this root, one original-application runtime started through the companion's own
 * contextual-preview route, and a successful self-fetch of the dashboard. Nothing is reported `ready` before that.
 */
export async function startPreviewServices(options: ServiceOptions, deps: ServiceDependencies = {}): Promise<ServiceResult> {
  const log = options.log ?? (() => undefined);
  const probePort = deps.probePort ?? probeLoopbackPort;
  const health = deps.health ?? healthOf;
  const fetchJson = deps.fetchJson ?? fetchJsonDefault;
  // The companion is detached so a terminal Ctrl-C reaches only this CLI. It exits by itself once no session holds a
  // lease, so the CLI never signals a companion that another session may be using. Output goes to a log file, so a
  // closed pipe cannot break the companion after this CLI exits.
  const spawnCompanion = deps.spawnCompanion ?? ((root: string, entry: string, logPath: string) => {
    const logFd = openSync(logPath, 'a');
    const child = spawn(process.execPath, [entry], {
      cwd: root,
      env: { ...process.env, RTL_PROJECT_ROOT: root, RTL_PREVIEW_EXIT_WHEN_IDLE: '1' },
      stdio: ['ignore', logFd, logFd],
      shell: false,
      detached: true,
    });
    child.unref();
    return child;
  });

  const root = await realpath(options.root);
  const cancelled = () => options.signal?.aborted === true;
  const served: { dashboard?: Server } = {};
  // This run's lease on the original server. Set only after the companion confirms the start.
  let lease: { application: string; token: string } | undefined;
  const logPath = join(options.dashboardDir, COMPANION_LOG);
  // Releases only this run's lease; never signals the companion. Safe to call repeatedly, and it also releases a
  // lease that arrives after an earlier call (cancellation can overlap a start request that is still in flight).
  const stop = async (): Promise<ReleaseOutcome> => {
    if (served.dashboard) {
      const dashboard = served.dashboard;
      served.dashboard = undefined;
      await close(dashboard);
    }
    const held = lease;
    if (!held) return 'not-held';
    lease = undefined;
    try {
      const response = await fetchJson(`${COMPANION_ORIGIN}/contextual-preview/original/release`, {
        method: 'POST',
        headers: { origin: DASHBOARD_ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ application: held.application, lease: held.token }),
      });
      return response.status === 200 ? 'released' : 'release-failed';
    } catch {
      return 'release-failed';
    }
  };
  const fail = async (state: 'unsupported' | 'startup_failed', reason: PreviewFailure): Promise<ServiceResult> => {
    await stop();
    return { state, failure: reason, stop: async () => 'not-held' };
  };
  // Cancellation must not wait for a blocked request: stop the owned companion immediately.
  options.signal?.addEventListener('abort', () => { void stop(); }, { once: true });
  const cancelledResult = () => fail('startup_failed', failure('CANCELLED', 'Live preview startup was cancelled. Owned services were stopped.'));

  // 1. Dashboard port: must be free, because the companion only accepts requests from this origin.
  if (!(await probePort(DASHBOARD_PORT))) {
    return fail('startup_failed', failure('PORT_CONFLICT_DASHBOARD', `Port ${DASHBOARD_PORT} is in use by another process. RTL Analyzer did not stop it; free the port and retry.`));
  }

  // 2. Companion: reuse only a companion that serves this exact root; otherwise the port must be free.
  const existing = await health(COMPANION_ORIGIN);
  if (existing) {
    if (existing.service !== 'rtl-preview-companion' || existing.projectRoot !== root) {
      return fail('startup_failed', failure('PORT_CONFLICT_COMPANION', `Port ${COMPANION_PORT} is serving a different service or project. RTL Analyzer did not stop it.`));
    }
    log(`Reusing the preview companion already serving this project on port ${COMPANION_PORT}.`);
  } else {
    if (!(await probePort(COMPANION_PORT))) {
      return fail('startup_failed', failure('PORT_CONFLICT_COMPANION', `Port ${COMPANION_PORT} is in use by another process. RTL Analyzer did not stop it; free the port and retry.`));
    }
    const companion = spawnCompanion(root, options.companionEntry, logPath);
    let stderrTail = '';
    companion.stderr?.on('data', chunk => { stderrTail = `${stderrTail}${String(chunk)}`.slice(-COMPANION_STDERR_TAIL); });
    const exited = new Promise<'exited'>(resolve => companion.once('exit', () => resolve('exited')));
    const deadline = Date.now() + COMPANION_READY_TIMEOUT_MS;
    let ready = false;
    while (Date.now() < deadline && !cancelled()) {
      const probe = await health(COMPANION_ORIGIN);
      if (probe && probe.service === 'rtl-preview-companion' && probe.projectRoot === root) { ready = true; break; }
      if (companion.exitCode !== null || companion.signalCode !== null) break;
      await Promise.race([sleep(150), exited]);
    }
    if (cancelled()) return cancelledResult();
    if (!ready) {
      const logged = await readFile(logPath, 'utf8').then(text => text.slice(-COMPANION_STDERR_TAIL), () => '');
      return fail('startup_failed', failure('COMPANION_START_FAILED', `The preview companion did not become ready. ${(stderrTail || logged).trim() || 'No error output.'}`.trim()));
    }
    log(`Preview companion ready on port ${COMPANION_PORT}.`);
  }

  // 3. Find a finding that the companion maps to a configured preview route. Read-only: nothing starts yet.
  let report: { inputDigest?: string; policyDigest?: string; findings?: Array<{ id: string }> };
  try {
    report = JSON.parse(await readFile(options.reportPath, 'utf8'));
  } catch {
    return fail('startup_failed', failure('REPORT_UNREADABLE', 'The scan report could not be read for preview mapping.'));
  }
  const params = (findingId: string) => new URLSearchParams({ findingId, inputDigest: String(report.inputDigest), policyDigest: String(report.policyDigest), mode: 'ltr' });
  let mappedFinding: string | undefined;
  let mappingError: string | undefined;
  for (const finding of (report.findings ?? []).slice(0, MAX_MAPPING_PROBES)) {
    if (cancelled()) return cancelledResult();
    try {
      const response = await fetchJson(`${COMPANION_ORIGIN}/contextual-preview?${params(finding.id)}`);
      if (response.status === 200 && response.body?.route) { mappedFinding = finding.id; break; }
      if (response.status !== 200) mappingError ??= String(response.body?.error ?? `HTTP ${response.status}`);
    } catch (error) {
      mappingError ??= error instanceof Error ? error.message : 'Preview mapping request failed.';
    }
  }
  if (!mappedFinding) {
    if (mappingError) return fail('startup_failed', failure('PREVIEW_MAPPING_FAILED', `Preview mapping failed: ${mappingError}`));
    return fail('unsupported', failure('PREVIEW_NO_MAPPED_FINDINGS', 'No finding in this report maps to a configured preview route.'));
  }

  // 4. Start the original application through the companion's own route (Origin = this dashboard's origin).
  if (cancelled()) return cancelledResult();
  try {
    const started = await fetchJson(`${COMPANION_ORIGIN}/contextual-preview/original?${params(mappedFinding)}`, {
      method: 'POST',
      headers: { origin: DASHBOARD_ORIGIN },
    });
    if (started.status !== 200) {
      return fail('startup_failed', failure('ORIGINAL_START_FAILED', `The original application did not start: ${String(started.body?.error ?? `HTTP ${started.status}`)}`));
    }
    if (started.body?.original?.available !== true) {
      return fail('startup_failed', failure('ORIGINAL_START_FAILED', `The original application did not become ready: ${String(started.body?.original?.reason ?? 'no reason reported')}`));
    }
    // Older companions omit the lease; this run then has nothing to release and reports `not-held`.
    const granted = started.body?.originalLease;
    if (typeof granted?.application === 'string' && typeof granted?.token === 'string') {
      lease = { application: granted.application, token: granted.token };
    }
  } catch (error) {
    return fail('startup_failed', failure('ORIGINAL_START_FAILED', `The original application did not start: ${error instanceof Error ? error.message : 'request failed'}`));
  }

  // 5. Serve the dashboard and prove it answers before reporting ready.
  if (cancelled()) return cancelledResult();
  const dashboard = serveDashboard(options.dashboardDir);
  served.dashboard = dashboard;
  try {
    await listen(dashboard);
  } catch {
    return fail('startup_failed', failure('PORT_CONFLICT_DASHBOARD', `Port ${DASHBOARD_PORT} became busy before the dashboard could start.`));
  }
  const dashboardUrl = `${DASHBOARD_ORIGIN}/${DASHBOARD_FILE}`;
  const selfCheck = await fetch(dashboardUrl, { signal: AbortSignal.timeout(2000) }).catch(() => null);
  if (!selfCheck?.ok) return fail('startup_failed', failure('DASHBOARD_SELF_CHECK_FAILED', 'The local dashboard server did not answer.'));

  return { state: 'ready', dashboardUrl, stop };
}

import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { CONTROLS_MARKUP, CONTROLS_SCRIPT } from './dashboard-controls.js';
import type { PreviewFailure } from './preview-orchestrator.js';
import { formatDiagnosticsForCopy } from './preview-diagnostics.js';
import { DASHBOARD_FILE, DASHBOARD_PORT, type ServiceResult } from './preview-services.js';

// Owns the dashboard HTTP server for an interactive run and the preview state shown to the page. The page can
// only drive this session: it cannot reach the companion's lease, and every action needs the per-run secret.

export type SessionState = 'starting' | 'ready' | 'unsupported' | 'startup_failed' | 'static' | 'ended';

export interface SessionStatus {
  readonly state: SessionState;
  readonly failure?: PreviewFailure;
}

export interface DashboardSessionOptions {
  /** Directory that contains the generated dashboard HTML. */
  readonly dashboardDir: string;
  /** One startup attempt. Called again on Retry Preview. */
  readonly start?: (signal: AbortSignal) => Promise<ServiceResult>;
  readonly log?: (line: string) => void;
  /** Use 0 in tests; the default is the fixed dashboard port the companion accepts. */
  readonly port?: number;
}

export class DashboardSession {
  private server?: Server;
  private port = 0;
  private readonly secret = randomUUID();
  private state: SessionState = 'static';
  private failure?: PreviewFailure;
  private services?: { readonly stop: () => Promise<'released' | 'not-held' | 'release-failed'> };
  private attempt?: { readonly controller: AbortController; readonly done: Promise<void> };
  private readonly endedPromise: Promise<void>;
  private resolveEnded!: () => void;
  private ended = false;

  constructor(private readonly options: DashboardSessionOptions) {
    this.endedPromise = new Promise(resolve => { this.resolveEnded = resolve; });
  }

  /** Binds the dashboard port and checks that the page answers. Throws when the port is unavailable. */
  async listen(): Promise<void> {
    const server = createServer((request, response) => { void this.handle(request, response); });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(this.options.port ?? DASHBOARD_PORT, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); });
    });
    this.server = server;
    this.port = (server.address() as AddressInfo).port;
    const check = await fetch(this.url, { signal: AbortSignal.timeout(2000) }).catch(() => null);
    if (!check?.ok) {
      server.close();
      throw new Error('The local dashboard server did not answer.');
    }
  }

  get url(): string {
    return `http://127.0.0.1:${this.port}/${DASHBOARD_FILE}`;
  }

  /** Sets a state that needs no startup attempt (for example, an unsupported project). */
  setInitial(state: 'unsupported', failure: PreviewFailure): void {
    this.state = state;
    this.failure = failure;
  }

  status(): SessionStatus {
    return { state: this.state, ...(this.failure ? { failure: this.failure } : {}) };
  }

  /** Runs one startup attempt in the background. Retry Preview and the first run both use this. */
  begin(): Promise<void> {
    if (this.attempt || this.ended || !this.options.start) return this.attempt?.done ?? Promise.resolve();
    const controller = new AbortController();
    this.state = 'starting';
    this.failure = undefined;
    const start = this.options.start;
    const done = (async () => {
      const result = await start(controller.signal);
      if (this.attempt?.controller !== controller || this.ended) {
        // Cancelled or ended while starting: release anything this attempt acquired and record nothing.
        await result.stop();
        return;
      }
      this.attempt = undefined;
      if (result.state === 'ready') {
        this.services = result;
        this.state = 'ready';
        this.failure = undefined;
      } else {
        this.state = result.state;
        this.failure = result.failure;
      }
    })().catch(error => {
      if (this.attempt?.controller === controller) {
        this.attempt = undefined;
        this.state = 'startup_failed';
        this.failure = { code: 'STARTUP_ERROR', message: error instanceof Error ? error.message : 'Startup failed.' };
      }
    });
    this.attempt = { controller, done };
    return done;
  }

  /** Resolves once the session has ended (End Review, Cancel of the whole run, or shutdown). */
  waitForEnd(): Promise<void> {
    return this.endedPromise;
  }

  /** Releases this run's lease, aborts any startup, and closes the dashboard server. Safe to call repeatedly. */
  async end(): Promise<void> {
    if (this.ended) return this.endedPromise;
    this.ended = true;
    await this.cancelWork(true);
    this.state = 'ended';
    await new Promise<void>(resolve => (this.server ? this.server.close(() => resolve()) : resolve()));
    this.resolveEnded();
  }

  /** Stops whatever this run holds: an in-flight startup (its result is released when it lands) and ready services. */
  private async cancelWork(waitForInflight: boolean): Promise<void> {
    // An in-flight startup that already granted a lease releases it when it lands. Cancel does not wait for that;
    // shutdown does, so no lease can outlive the process.
    const inflight = this.attempt;
    this.attempt = undefined;
    inflight?.controller.abort();
    if (inflight && waitForInflight) await inflight.done;
    const held = this.services;
    this.services = undefined;
    if (held) {
      const outcome = await held.stop();
      if (outcome === 'release-failed') this.options.log?.('The preview companion did not confirm this run\'s release.');
    }
  }

  private async act(path: string): Promise<{ status: number; body: unknown }> {
    switch (path) {
      case '/preview/retry':
        if (this.state !== 'startup_failed') return { status: 409, body: { error: 'RETRY_NOT_AVAILABLE' } };
        void this.begin();
        return { status: 202, body: this.status() };
      case '/preview/cancel':
        await this.cancelWork(false);
        this.state = 'static';
        this.failure = undefined;
        return { status: 200, body: this.status() };
      case '/preview/diagnostics': {
        // Sanitized plain text for Copy Diagnostics. Only a classified startup failure has anything to copy.
        const diagnostic = this.failure?.diagnostic;
        if (!diagnostic) return { status: 409, body: { error: 'DIAGNOSTICS_NOT_AVAILABLE' } };
        return { status: 200, body: { text: formatDiagnosticsForCopy(diagnostic) } };
      }
      case '/preview/continue':
        if (this.state === 'startup_failed' || this.state === 'unsupported') {
          this.state = 'static';
          this.failure = undefined;
        }
        return { status: 200, body: this.status() };
      case '/preview/end':
        // Respond first, then tear down; the page shows the ended state from this response.
        setImmediate(() => { void this.end(); });
        this.state = 'ended';
        return { status: 200, body: this.status() };
      default:
        return { status: 404, body: { error: 'NOT_FOUND' } };
    }
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const path = (request.url ?? '/').split('?')[0];
    const send = (status: number, body: unknown, type = 'application/json') => {
      response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
      response.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    if (request.method === 'GET' && path === `/${DASHBOARD_FILE}`) {
      try {
        send(200, await this.pageHtml(), 'text/html; charset=utf-8');
      } catch {
        send(404, { error: 'NOT_FOUND' });
      }
      return;
    }
    if (request.method === 'GET' && path === '/preview/status') {
      send(200, this.status());
      return;
    }
    if (request.method === 'POST' && path.startsWith('/preview/')) {
      const origin = request.headers.origin;
      // Origin and the session secret both gate actions; neither one alone is authentication for this session.
      if (origin !== `http://127.0.0.1:${this.port}` || request.headers['x-rtl-session'] !== this.secret) {
        send(403, { error: 'SESSION_REQUEST_REJECTED' });
        return;
      }
      const result = await this.act(path);
      send(result.status, result.body);
      return;
    }
    send(404, { error: 'NOT_FOUND' });
  }

  private async pageHtml(): Promise<string> {
    const html = await readFile(`${this.options.dashboardDir}/${DASHBOARD_FILE}`, 'utf8');
    // JSON with < escaped, so no status text can close the script element.
    const config = JSON.stringify({ secret: this.secret, ...this.status() }).replace(/</g, '\\u003c');
    const script = `<script>window.__RTL_PREVIEW_SESSION__=${config};</script>\n<script>${CONTROLS_SCRIPT}</script>`;
    // The status bar is placed in normal page flow at the top of the body, not as a fixed overlay, so it never covers
    // Approve, Validate, Apply or navigation controls at the bottom or right edge of the review.
    const withBar = /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, match => `${match}\n${CONTROLS_MARKUP}`) : `${CONTROLS_MARKUP}\n${html}`;
    return withBar.includes('</body>') ? withBar.replace('</body>', () => `${script}\n</body>`) : `${withBar}\n${script}`;
  }
}

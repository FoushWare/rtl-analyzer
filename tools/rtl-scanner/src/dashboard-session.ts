import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { CONTROLS_MARKUP, CONTROLS_SCRIPT } from './dashboard-controls.js';
import type { PreviewFailure } from './preview-orchestrator.js';
import { formatDiagnosticsForCopy } from './preview-diagnostics.js';
import { COMPANION_PORT, DASHBOARD_FILE, DASHBOARD_PORT, type ServiceResult } from './preview-services.js';
import { COMPANION_BOOTSTRAP_HEADER, COMPANION_SESSION_HEADER, isAllowedLoopbackHost, readCompanionBootstrap, redactAbsolutePaths } from './companion-auth.js';

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
  private services?: { readonly stop: () => Promise<'released' | 'not-held' | 'release-failed'>; readonly companion?: { readonly origin: string; readonly bootstrap: string } };
  // The companion session token this dashboard hands to its page. It is reused while the companion accepts it, replaced
  // only after the companion rejects it (for example after a restart), and minted once for concurrent requests.
  private pageToken?: string;
  private pageTokenMint?: Promise<string | undefined>;
  // The companion bootstrap secret under which pageToken was issued.
  private pageTokenBootstrap?: string;
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
    await this.revokePageTokens();
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
        return { status: 200, body: { text: redactAbsolutePaths(formatDiagnosticsForCopy(diagnostic)) } };
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
    // DNS-rebinding defense: only the exact loopback host names for this server's port reach any handler.
    if (!isAllowedLoopbackHost(request.headers.host, this.port)) {
      response.writeHead(403, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ error: 'HOST_NOT_ALLOWED' }));
      return;
    }
    const send = (status: number, body: unknown, type = 'application/json') => {
      response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
      response.end(typeof body === 'string' ? body : JSON.stringify(body));
    };
    if (request.method === 'GET' && path === `/${DASHBOARD_FILE}`) {
      // The report and its session secret are served only to top-level navigations and same-origin fetches, never cross-site.
      const site = request.headers['sec-fetch-site'];
      if (site !== undefined && site !== 'none' && site !== 'same-origin') { send(403, { error: 'CROSS_SITE_REQUEST_REJECTED' }); return; }
      try {
        send(200, await this.pageHtml(), 'text/html; charset=utf-8');
      } catch {
        send(404, { error: 'NOT_FOUND' });
      }
      return;
    }
    if (request.method === 'GET' && path === '/preview/companion-session') {
      // Same-origin page requests only: cross-site navigations and fetches are refused, as for the report itself.
      const site = request.headers['sec-fetch-site'];
      if (site !== undefined && site !== 'none' && site !== 'same-origin') { send(403, { error: 'CROSS_SITE_REQUEST_REJECTED' }); return; }
      // `rejected` names a token the page just got 401 for. Only that token is replaced; a newer live token is returned as is.
      const rejected = new URL(request.url ?? '/', 'http://127.0.0.1').searchParams.get('rejected') ?? undefined;
      const token = await this.mintPageToken(rejected);
      if (!token) { const starting = this.state === 'starting'; send(starting ? 202 : 409, { error: starting ? 'COMPANION_STARTING' : 'COMPANION_NOT_READY', state: this.state }); return; }
      send(200, { token });
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


  /** Revokes the page's companion token (session termination). Safe to call when none is held. */
  private async revokePageTokens(): Promise<void> {
    const companion = this.services?.companion;
    const token = this.pageToken;
    this.pageToken = undefined;
    if (!companion || !token) return;
    await fetch(`${companion.origin}/auth/revoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [COMPANION_BOOTSTRAP_HEADER]: companion.bootstrap },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => undefined);
  }

  /**
   * Returns the page's companion token. A live token is returned without minting. A `rejected` token (the companion refused
   * it) is replaced once: concurrent callers share one in-flight mint, so no request revokes a token another request holds.
   * A companion restart replaces its bootstrap secret, so a refused mint re-reads the published secret once and retries.
   */
  private async mintPageToken(rejected?: string): Promise<string | undefined> {
    const companion = this.services?.companion;
    if (!companion || this.state !== 'ready') return undefined;
    // A companion restart publishes a new bootstrap secret. A token issued under the previous secret is dead even if the page
    // has not been refused yet, so reuse requires the same bootstrap identity as the one that issued it.
    const published = readCompanionBootstrap(Number(new URL(companion.origin).port));
    if (published && published !== companion.bootstrap) (companion as { bootstrap: string }).bootstrap = published;
    if (this.pageToken && this.pageToken !== rejected && this.pageTokenBootstrap === companion.bootstrap) return this.pageToken;
    if (!this.pageTokenMint) {
      this.pageTokenMint = this.issuePageToken(companion, this.pageToken).finally(() => { this.pageTokenMint = undefined; });
    }
    return this.pageTokenMint;
  }

  private async issuePageToken(companion: { readonly origin: string; readonly bootstrap: string }, previous: string | undefined): Promise<string | undefined> {
    if (previous) {
      this.pageToken = undefined;
      await fetch(`${companion.origin}/auth/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [COMPANION_BOOTSTRAP_HEADER]: companion.bootstrap },
        body: JSON.stringify({ token: previous }),
        signal: AbortSignal.timeout(2000),
      }).catch(() => undefined);
    }
    const mint = (bootstrap: string) => fetch(`${companion.origin}/auth/session`, {
      method: 'POST',
      headers: { [COMPANION_BOOTSTRAP_HEADER]: bootstrap },
      signal: AbortSignal.timeout(2000),
    }).catch(() => null);
    let response = await mint(companion.bootstrap);
    if (response?.status === 401) {
      const fresh = readCompanionBootstrap(Number(new URL(companion.origin).port));
      if (fresh && fresh !== companion.bootstrap) { (companion as { bootstrap: string }).bootstrap = fresh; response = await mint(fresh); }
    }
    if (!response?.ok) return undefined;
    const issuedUnder = companion.bootstrap;
    const issued = (await response.json().catch(() => ({}))) as { token?: unknown };
    if (typeof issued.token !== 'string') return undefined;
    this.pageToken = issued.token;
    this.pageTokenBootstrap = issuedUnder;
    return issued.token;
  }

  private async pageHtml(): Promise<string> {
    const html = await readFile(`${this.options.dashboardDir}/${DASHBOARD_FILE}`, 'utf8');
    const companion = this.services?.companion;
    // JSON with < escaped, so no status text can close the script element.
    const config = JSON.stringify({ secret: this.secret, ...this.status(), companionOrigin: `http://127.0.0.1:${COMPANION_PORT}` }).replace(/</g, '\\u003c');
    // Runs before the page script. Requests to the companion origin get a session header; the token is fetched from this
    // dashboard (same origin, Host-checked) on first use, so a page loaded while the preview is still starting still works.
    // A 401 from the companion means the token expired or was revoked: the guard fetches a fresh one and retries once.
    const guard = `(function(){
 var c=window.__RTL_PREVIEW_SESSION__||{};var o=c.companionOrigin;if(!o||!window.fetch)return;
 var H='x-rtl-companion-session';var tok=null;var f=window.fetch.bind(window);
 // Fetches the page's token. rejected names the token the companion refused, so the dashboard replaces only that one.
 function attempt(n,rejected){
  var url='/preview/companion-session'+(rejected?'?rejected='+encodeURIComponent(rejected):'');
  return f(url,{cache:'no-store',credentials:'same-origin'}).then(function(r){
   if(r.status===202&&n<240)return new Promise(function(res){setTimeout(res,250);}).then(function(){return attempt(n+1,rejected);});
   return r.ok?r.json().then(function(b){tok=(b&&b.token)||null;return tok;}):null;
  }).catch(function(){return null;});
 }
 function token(){return tok?Promise.resolve(tok):attempt(0);}
 function withToken(input,init,t){var h=new Headers((init&&init.headers)||(typeof input!=='string'&&input.headers)||undefined);h.set(H,t);return Object.assign({},init||{},{headers:h});}
 function method(input,init){return String((init&&init.method)||(typeof input!=='string'&&input.method)||'GET').toUpperCase();}
 window.fetch=function(input,init){
  var u=typeof input==='string'?input:(input&&input.url)||'';
  if(u!==o&&u.indexOf(o+'/')!==0)return f(input,init);
  var safe=method(input,init)==='GET'||method(input,init)==='HEAD';
  return token().then(function(t){
   if(!t)return f(input,init);
   return f(input,withToken(input,init,t)).then(function(res){
    if(res.status!==401)return res;
    tok=null;
    // Only idempotent reads are retried after recovery. A write refused for authorization is reported, never replayed.
    if(!safe)return res;
    return attempt(0,t).then(function(t2){return t2?f(input,withToken(input,init,t2)):res;});
   });
  });
 };
})();`;
    const head = `<script>window.__RTL_PREVIEW_SESSION__=${config};${guard}</script>`;
const script = `<script>window.__RTL_PREVIEW_SESSION__=${config};</script>\n<script>${CONTROLS_SCRIPT}</script>`;
    // The status bar is placed in normal page flow at the top of the body, not as a fixed overlay, so it never covers
    // Approve, Validate, Apply or navigation controls at the bottom or right edge of the review.
    const withHead = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, match => `${match}\n${head}`) : `${head}\n${html}`;
    const withBar = /<body\b[^>]*>/i.test(withHead) ? withHead.replace(/<body\b[^>]*>/i, match => `${match}\n${CONTROLS_MARKUP}`) : `${CONTROLS_MARKUP}\n${withHead}`;
    return withBar.includes('</body>') ? withBar.replace('</body>', () => `${script}\n</body>`) : `${withBar}\n${script}`;
  }

}

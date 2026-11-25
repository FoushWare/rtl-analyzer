// Mirror of implementation/tools/rtl-scanner/src/companion-auth.ts for overlay typechecking (rootDir forbids a re-export).
// The build compiles the pinned file; a regression test fails if this copy drifts.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync, lstatSync, chmodSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { dirname, join } from 'node:path';

// Authorization and transport helpers for the loopback companion and dashboard servers (security hardening).
// Nothing here reads or writes project files; it only manages in-memory session tokens and a per-port bootstrap file.

/** Header that carries a companion session token (issued to one dashboard page). */
export const COMPANION_SESSION_HEADER = 'x-rtl-companion-session';
/** Header that carries the per-run bootstrap secret. Only the CLI process that started or reused the companion holds it. */
export const COMPANION_BOOTSTRAP_HEADER = 'x-rtl-companion-bootstrap';

/** Accepts exactly the loopback host names this tool binds to, on the port it listens on (DNS-rebinding defense). */
export function isAllowedLoopbackHost(host: string | undefined, port: number): boolean {
  if (typeof host !== 'string' || host.length === 0) return false;
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

/** Constant-time comparison of two secrets of arbitrary length (both are hashed first, so lengths never leak). */
export function secretsEqual(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== 'string' || candidate.length === 0) return false;
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b) && candidate.length === expected.length;
}

/** Stable digest of a project root, so a health check can identify a companion without disclosing its path. */
export function projectRootDigest(root: string): string {
  return createHash('sha256').update(root).digest('hex');
}

/**
 * Removes absolute filesystem paths from text that may reach an HTTP response, a dashboard, or a copied diagnostic.
 * Relative repository paths (for example `src/App.tsx`) are kept, because the review UI needs them.
 */
export function redactAbsolutePaths(text: string): string {
  return text
    .replace(/[A-Za-z]:\\[^\s'"`<>)\]]+/g, '<path>')
    .replace(/(^|[\s'"`(\[=:])\/[^\s'"`<>)\]]+/g, (_match, prefix: string) => `${prefix}<path>`);
}

interface SessionRecord { readonly issuedAt: number; lastSeen: number }

/**
 * Session tokens for dashboard pages. A token is 256 random bits, lives only in memory, expires after an idle period
 * or an absolute lifetime, and dies with the companion process. Revoking a token takes effect immediately.
 */
export class CompanionSessions {
  private readonly records = new Map<string, SessionRecord>();
  constructor(
    private readonly idleMs: number,
    private readonly maxMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  issue(): { token: string; expiresAt: string } {
    const token = randomBytes(32).toString('base64url');
    const issuedAt = this.now();
    this.records.set(token, { issuedAt, lastSeen: issuedAt });
    return { token, expiresAt: new Date(Math.min(issuedAt + this.idleMs, issuedAt + this.maxMs)).toISOString() };
  }

  /** True when the token is live. A successful check slides the idle window. */
  validate(token: unknown): boolean {
    if (typeof token !== 'string') return false;
    const record = this.records.get(token);
    if (!record) return false;
    const now = this.now();
    if (now - record.lastSeen > this.idleMs || now - record.issuedAt > this.maxMs) {
      this.records.delete(token);
      return false;
    }
    record.lastSeen = now;
    return true;
  }

  revoke(token: unknown): boolean {
    return typeof token === 'string' && this.records.delete(token);
  }

  /** Drops every token (used when the companion shuts down). */
  clear(): void {
    this.records.clear();
  }

  get size(): number {
    return this.records.size;
  }
}

/** Per-user directory for companion bootstrap files (owner-only). */
export function companionBootstrapPath(port: number, base = tmpdir()): string {
  const owner = (() => { try { return String(userInfo().uid); } catch { return 'user'; } })();
  return join(base, `rtl-analyzer-auth-${owner}`, `companion-${port}.json`);
}

/**
 * Creates a fresh bootstrap secret and writes it to an owner-only file. The file is replaced, never followed: an existing
 * symbolic link or foreign file at that path is removed before creation.
 */
export function writeCompanionBootstrap(port: number, root: string, base = tmpdir()): string {
  const path = companionBootstrapPath(port, base);
  const directory = dirname(path);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { chmodSync(directory, 0o700); } catch { /* best effort on non-POSIX systems */ }
  try { lstatSync(path); unlinkSync(path); } catch { /* absent */ }
  const secret = randomBytes(32).toString('base64url');
  writeFileSync(path, JSON.stringify({ port, projectRootDigest: projectRootDigest(root), bootstrap: secret, pid: process.pid }), { flag: 'wx', mode: 0o600 });
  return secret;
}

/** Reads the bootstrap secret for a companion port, or undefined when absent or unreadable. */
export function readCompanionBootstrap(port: number, base = tmpdir()): string | undefined {
  try {
    const record = JSON.parse(readFileSync(companionBootstrapPath(port, base), 'utf8')) as { bootstrap?: unknown; port?: unknown };
    return typeof record.bootstrap === 'string' && record.port === port ? record.bootstrap : undefined;
  } catch {
    return undefined;
  }
}

/** Removes this process's bootstrap file. Safe to call more than once. */
export function removeCompanionBootstrap(port: number, base = tmpdir()): void {
  const path = companionBootstrapPath(port, base);
  try {
    const record = JSON.parse(readFileSync(path, 'utf8')) as { pid?: unknown };
    if (record.pid === process.pid) unlinkSync(path);
  } catch { /* absent or unreadable: nothing of ours to remove */ }
}

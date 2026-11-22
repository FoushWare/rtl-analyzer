import { EventEmitter } from 'node:events';
import { mkdtemp, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { startPreviewServices, type ServiceDependencies } from '../src/preview-services.js';

interface FakeChild extends EventEmitter { exitCode: number | null; signalCode: string | null; signals: string[]; kill(signal?: string): boolean; stderr: EventEmitter }

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.exitCode = null;
  child.signalCode = null;
  child.signals = [];
  child.stderr = new EventEmitter();
  child.kill = (signal = 'SIGTERM') => { child.signals.push(signal); return true; };
  return child;
}

async function fixture(findingIds: string[] = ['f1']) {
  // The service compares against the resolved root, so the fixture must use the same realpath.
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'rtl-services-')));
  await writeFile(join(dir, 'rtl-report-dashboard.html'), '<!doctype html><title>dashboard</title>');
  await writeFile(join(dir, 'rtl-report.json'), JSON.stringify({ inputDigest: 'in', policyDigest: 'pol', findings: findingIds.map(id => ({ id })) }));
  return { root: dir, dashboardDir: dir, reportPath: join(dir, 'rtl-report.json'), companionEntry: '/packaged/preview-cli.js' };
}

interface HarnessOptions {
  mapRoute?: (id: string) => boolean;
  originalAvailable?: boolean;
  /** `legacy` omits the lease, like a companion from before leases existed. */
  startLease?: 'granted' | 'legacy';
  releaseStatus?: number;
  /** Delay before the start response, to simulate a start that is still in flight. */
  startDelayMs?: number;
  companionHealth?: Record<string, unknown> | null;
  child?: FakeChild;
}

function harness(options: HarnessOptions, root: string) {
  const spawned: { entry: string; logPath: string }[] = [];
  const released: unknown[] = [];
  let running = false;
  const child = options.child ?? fakeChild();
  const deps: ServiceDependencies = {
    probePort: async () => true,
    health: async origin => {
      if (!origin.endsWith(':4318')) return null;
      if (options.companionHealth !== undefined) return options.companionHealth;
      return running ? { service: 'rtl-preview-companion', projectRoot: root } : null;
    },
    spawnCompanion: (_root, entry, logPath) => { spawned.push({ entry, logPath }); running = true; return child as unknown as ChildProcess; },
    fetchJson: async (url, init) => {
      if (url.includes('/contextual-preview?')) {
        const id = new URL(url).searchParams.get('findingId') ?? '';
        return { status: 200, body: { route: options.mapRoute?.(id) === false ? null : { id: 'orders' } } };
      }
      if (url.endsWith('/contextual-preview/original/release') && init?.method === 'POST') {
        released.push(JSON.parse(String(init.body)));
        return { status: options.releaseStatus ?? 200, body: {} };
      }
      if (url.includes('/contextual-preview/original') && init?.method === 'POST') {
        if (options.startDelayMs) await new Promise(resolve => setTimeout(resolve, options.startDelayMs));
        const lease = options.startLease === 'legacy' ? {} : { originalLease: { application: 'dashboard', token: 'lease-1' } };
        return { status: 200, body: { original: { available: options.originalAvailable ?? true }, ...lease } };
      }
      throw new Error('unexpected ' + url);
    },
  };
  return { deps, spawned, released, child };
}

describe('preview services', () => {
  it('refuses to start when the dashboard port is occupied, without spawning anything', async () => {
    const f = await fixture();
    const h = harness({}, f.root);
    const result = await startPreviewServices(f, { ...h.deps, probePort: async () => false });
    expect(result).toMatchObject({ state: 'startup_failed', failure: { code: 'PORT_CONFLICT_DASHBOARD' } });
    expect(h.spawned).toEqual([]);
  });

  it('never reuses a service that serves a different project or is not a companion', async () => {
    const f = await fixture();
    const other = harness({ companionHealth: { service: 'rtl-preview-companion', projectRoot: '/elsewhere' } }, f.root);
    expect(await startPreviewServices(f, other.deps)).toMatchObject({ state: 'startup_failed', failure: { code: 'PORT_CONFLICT_COMPANION' } });
    const foreign = harness({ companionHealth: { ok: true } }, f.root);
    expect(await startPreviewServices(f, foreign.deps)).toMatchObject({ failure: { code: 'PORT_CONFLICT_COMPANION' } });
    expect(other.spawned.concat(foreign.spawned)).toEqual([]);
  });

  it('spawns the packaged companion, releases only its own lease on stop, and never signals the companion', async () => {
    const f = await fixture(['f1', 'f2']);
    const h = harness({ mapRoute: id => id === 'f2' }, f.root);
    const result = await startPreviewServices(f, h.deps);
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready');
    expect(h.spawned).toEqual([{ entry: '/packaged/preview-cli.js', logPath: join(f.dashboardDir, 'preview-companion.log') }]);
    expect(await result.stop()).toBe('released');
    expect(h.released).toEqual([{ application: 'dashboard', lease: 'lease-1' }]);
    expect(h.child.signals).toEqual([]);
  });

  it('reuses a compatible companion, releases only its own lease, and never terminates the companion', async () => {
    const f = await fixture();
    const h = harness({ companionHealth: { service: 'rtl-preview-companion', projectRoot: f.root } }, f.root);
    const result = await startPreviewServices(f, h.deps);
    expect(result.state).toBe('ready');
    if (result.state !== 'ready') throw new Error('expected ready');
    expect(h.spawned).toEqual([]);
    expect(await result.stop()).toBe('released');
    expect(h.child.signals).toEqual([]);
  });

  it('reports a failed release instead of hiding a possibly running original', async () => {
    const f = await fixture();
    const h = harness({ releaseStatus: 404 }, f.root);
    const result = await startPreviewServices(f, h.deps);
    if (result.state !== 'ready') throw new Error('expected ready');
    expect(await result.stop()).toBe('release-failed');
  });

  it('treats an older companion without leases as nothing to release', async () => {
    const f = await fixture();
    const h = harness({ startLease: 'legacy' }, f.root);
    const result = await startPreviewServices(f, h.deps);
    if (result.state !== 'ready') throw new Error('expected ready');
    expect(await result.stop()).toBe('not-held');
    expect(h.released).toEqual([]);
  });

  it('reports a failed original start without signalling the companion', async () => {
    const f = await fixture();
    const h = harness({ originalAvailable: false }, f.root);
    const result = await startPreviewServices(f, h.deps);
    expect(result).toMatchObject({ state: 'startup_failed', failure: { code: 'ORIGINAL_START_FAILED' } });
    expect(h.child.signals).toEqual([]);
  });

  it('distinguishes unsupported mapping (no route) from a startup failure', async () => {
    const f = await fixture();
    const h = harness({ mapRoute: () => false }, f.root);
    const result = await startPreviewServices(f, h.deps);
    expect(result).toMatchObject({ state: 'unsupported', failure: { code: 'PREVIEW_NO_MAPPED_FINDINGS' } });
    expect(h.child.signals).toEqual([]);
  });

  it('reports a companion that exits before becoming ready with its error output', async () => {
    const f = await fixture();
    const child = fakeChild();
    const h = harness({ child, companionHealth: null }, f.root);
    const pending = startPreviewServices(f, { ...h.deps, health: async () => null, spawnCompanion: () => { setTimeout(() => { child.stderr.emit('data', 'EADDRINUSE: boom'); child.exitCode = 1; child.emit('exit', 1); }, 20); return child as unknown as ChildProcess; } });
    const result = await pending;
    expect(result).toMatchObject({ state: 'startup_failed', failure: { code: 'COMPANION_START_FAILED' } });
    expect(result.state !== 'ready' && result.failure.message).toContain('EADDRINUSE: boom');
  });

  it('cancels a blocked companion startup without signalling the companion', async () => {
    const f = await fixture();
    const child = fakeChild();
    const controller = new AbortController();
    const started = Date.now();
    const pending = startPreviewServices({ ...f, signal: controller.signal }, { probePort: async () => true, health: async () => null, spawnCompanion: () => child as unknown as ChildProcess });
    setTimeout(() => controller.abort(), 100);
    const result = await pending;
    expect(result).toMatchObject({ state: 'startup_failed', failure: { code: 'CANCELLED' } });
    expect(child.signals).toEqual([]);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it('releases a lease granted after cancellation overlapped the start request', async () => {
    const f = await fixture();
    const controller = new AbortController();
    const h = harness({ startDelayMs: 150 }, f.root);
    setTimeout(() => controller.abort(), 50);
    const result = await startPreviewServices({ ...f, signal: controller.signal }, h.deps);
    expect(result).toMatchObject({ state: 'startup_failed', failure: { code: 'CANCELLED' } });
    expect(h.released).toEqual([{ application: 'dashboard', lease: 'lease-1' }]);
  });
});

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { DEFAULT_MANUAL_CHANGE_STORE_PATH } from './manual-change-store.js';
import type { ScanManifest, ReconciledFinding } from './scan-history.js';
import { reconcileScans } from './scan-history.js';

export const DEFAULT_SCAN_MANIFEST_STORE_PATH = process.env.RTL_SCAN_MANIFEST_STORE_PATH || `${dirname(DEFAULT_MANUAL_CHANGE_STORE_PATH)}/scan-manifests-v1.json`;
export interface StoredScan { readonly manifest: ScanManifest; readonly reconciliation: readonly ReconciledFinding[] }
export class ScanManifestStore {
  private scans: StoredScan[] = [];
  private loaded = false;
  constructor(readonly path = DEFAULT_SCAN_MANIFEST_STORE_PATH) {}
  async load(): Promise<void> { try { this.scans = JSON.parse(await readFile(this.path, 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('SCAN_MANIFEST_STORE_UNAVAILABLE'); this.scans = []; } this.loaded = true; }
  list(): readonly StoredScan[] { return this.scans.slice().reverse(); }
  latest(): StoredScan | null { return this.scans.at(-1) ?? null; }
  async append(manifest: ScanManifest): Promise<StoredScan> { if (!this.loaded) throw new Error('SCAN_MANIFEST_STORE_NOT_LOADED'); if (!manifest.scanId || !manifest.inputDigest || !manifest.policyDigest || !Array.isArray(manifest.findings)) throw new Error('INVALID_SCAN_MANIFEST'); if (manifest.sourceCoverage?.complete === false) { /* incomplete scans are retained but cannot resolve absences */ } const item = { manifest, reconciliation: reconcileScans(this.latest()?.manifest ?? null, manifest) }; this.scans.push(item); await mkdir(dirname(this.path), { recursive: true, mode: 0o700 }); const tmp = `${this.path}.${process.pid}.tmp`; await writeFile(tmp, `${JSON.stringify(this.scans, null, 2)}\n`, { mode: 0o600, flag: 'wx' }); await rename(tmp, this.path); return item; }
}

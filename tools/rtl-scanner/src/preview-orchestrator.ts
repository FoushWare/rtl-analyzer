import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Milestone 1: structured preview states and the consent gate. No process is started here.

export const PREVIEW_CONFIGURATION_FILE = 'rtl-preview.config.json';
export const PREVIEW_STATES = ['starting', 'ready', 'unsupported', 'startup_failed'] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number];

export interface PreviewFailure {
  readonly code: string;
  readonly message: string;
}

export interface PreviewStatus {
  readonly state: PreviewState;
  readonly failure?: PreviewFailure;
}

export interface PreviewApplicationPlan {
  readonly application: string;
  readonly origin: string;
  readonly port: number;
  readonly startupScript?: string;
}

/** `eligible` means the project matches the verified Vite/Nx-Vite contract. Nothing has been started. */
export type PreviewEligibility =
  | { readonly eligible: true; readonly applications: readonly PreviewApplicationPlan[]; readonly commands: readonly string[] }
  | { readonly eligible: false; readonly failure: PreviewFailure };

const VITE_CONFIG = /\.(?:[cm]?[jt]s)$/;
const SCRIPT_NAME = /^[-\w:]+$/;
const LOOPBACK_ORIGIN = /^http:\/\/127\.0\.0\.1:(\d{1,5})$/;

function unsupported(code: string, message: string): PreviewEligibility {
  return { eligible: false, failure: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Decides whether the project matches the verified live-preview contract: a Vite config per application,
 * a loopback origin, a ready selector, and either a package script or the project's own Vite binary.
 * Everything else is `unsupported` with a stable reason code; it is never reported as a startup failure.
 */
export async function inspectPreviewProject(root: string): Promise<PreviewEligibility> {
  let raw: string;
  try {
    raw = await readFile(join(root, PREVIEW_CONFIGURATION_FILE), 'utf8');
  } catch {
    return unsupported('PREVIEW_CONFIGURATION_MISSING', `No ${PREVIEW_CONFIGURATION_FILE}. Live Before/After needs a Vite or Nx-Vite project with a preview configuration.`);
  }
  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch {
    return unsupported('PREVIEW_CONFIGURATION_INVALID', `${PREVIEW_CONFIGURATION_FILE} is not valid JSON.`);
  }
  if (!isRecord(config) || config.schemaVersion !== 1 || !isRecord(config.applications)) {
    return unsupported('PREVIEW_CONFIGURATION_INVALID', `${PREVIEW_CONFIGURATION_FILE} must declare schemaVersion 1 and applications.`);
  }
  const entries = Object.entries(config.applications);
  if (entries.length === 0) return unsupported('PREVIEW_CONFIGURATION_INVALID', 'No preview applications are configured.');

  let packageScripts: Record<string, unknown> = {};
  try {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as { scripts?: unknown };
    if (isRecord(pkg.scripts)) packageScripts = pkg.scripts;
  } catch {
    // A missing or unreadable package.json is handled by the script and Vite checks below.
  }

  const applications: PreviewApplicationPlan[] = [];
  const ports = new Set<number>();
  for (const [application, value] of entries) {
    if (!isRecord(value)) return unsupported('PREVIEW_CONFIGURATION_INVALID', `Application "${application}" is not an object.`);
    const viteConfig = value.viteConfig;
    if (typeof viteConfig !== 'string' || !VITE_CONFIG.test(viteConfig) || viteConfig.includes('..')) {
      return unsupported('PREVIEW_UNSUPPORTED_BUILD_TOOL', `Application "${application}" needs a Vite config file (.js, .mjs or .ts).`);
    }
    if (typeof value.readySelector !== 'string' || value.readySelector.trim() === '') {
      return unsupported('PREVIEW_CONFIGURATION_INVALID', `Application "${application}" needs a readySelector.`);
    }
    const origin = typeof value.originalOrigin === 'string' ? LOOPBACK_ORIGIN.exec(value.originalOrigin) : null;
    if (!origin) return unsupported('PREVIEW_CONFIGURATION_INVALID', `Application "${application}" needs an originalOrigin on 127.0.0.1.`);
    const port = Number(origin[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535 || ports.has(port)) {
      return unsupported('PREVIEW_CONFIGURATION_INVALID', `Application "${application}" has an invalid or duplicated port.`);
    }
    ports.add(port);

    const startupScript = value.startupScript;
    if (startupScript !== undefined) {
      if (typeof startupScript !== 'string' || !SCRIPT_NAME.test(startupScript)) {
        return unsupported('PREVIEW_CONFIGURATION_INVALID', `Application "${application}" has an invalid startupScript name.`);
      }
      if (typeof packageScripts[startupScript] !== 'string') {
        return unsupported('PREVIEW_STARTUP_SCRIPT_MISSING', `package.json has no "${startupScript}" script for application "${application}".`);
      }
    } else if (!(await exists(join(root, 'node_modules', 'vite', 'bin', 'vite.js')))) {
      return unsupported('PREVIEW_VITE_NOT_INSTALLED', `Application "${application}" has no startupScript and Vite is not installed in node_modules.`);
    }
    applications.push({ application, origin: origin[0], port, ...(startupScript ? { startupScript } : {}) });
  }

  const commands = applications.map(app => app.startupScript
    ? `npm run ${app.startupScript} -- --host 127.0.0.1 --port ${app.port} --strictPort   (${app.application})`
    : `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${app.port} --strictPort   (${app.application})`);
  return { eligible: true, applications, commands };
}

export type ConsentDecision =
  | { readonly approved: true; readonly source: 'flag' | 'prompt' }
  | { readonly approved: false; readonly failure: PreviewFailure };

export interface ConsentOptions {
  /** Explicit authorization from the command line (`--approve-project-scripts`). */
  readonly authorized?: boolean;
  readonly interactive: boolean;
  readonly ask: (question: string) => Promise<string>;
  readonly write: (line: string) => void;
}

/** Project scripts run only after explicit approval. Non-interactive runs decline unless authorized. */
export async function decidePreviewConsent(eligibility: Extract<PreviewEligibility, { eligible: true }>, options: ConsentOptions): Promise<ConsentDecision> {
  if (options.authorized) return { approved: true, source: 'flag' };
  if (!options.interactive) {
    return { approved: false, failure: { code: 'PREVIEW_APPROVAL_REQUIRED', message: 'Live preview needs approval to run project scripts. Re-run with --approve-project-scripts to authorize it.' } };
  }
  options.write('RTL Analyzer can start your project\'s dev server for live Before/After previews. It will run:');
  for (const command of eligibility.commands) options.write(`  ${command}`);
  const answer = (await options.ask('Run these project scripts now? [y/N] ')).trim().toLowerCase();
  if (answer === 'y' || answer === 'yes') return { approved: true, source: 'prompt' };
  return { approved: false, failure: { code: 'PREVIEW_DECLINED', message: 'Live preview was not approved. The static report is still available.' } };
}

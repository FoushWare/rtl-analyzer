import { lstat, readFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';

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

// A Vite config is recognized by its file name AND by its content: it must import `vite`. A file name alone is not
// enough, because a Next.js config (next.config.mjs) or any other module can carry a .mjs/.ts extension.
const VITE_CONFIG_NAME = /^vite\.config\.(?:[cm]?[jt]s)$/;
const VITE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']vite["']/;
const NEXT_NAME = /^next\.config\.(?:[cm]?[jt]s|json)$/;
// A start script that runs the Next.js CLI (directly or through a package runner). Vite arguments must never reach it.
const NEXT_COMMAND = /(?:^|[\s;&|(])(?:npx\s+|pnpm\s+(?:exec\s+)?|yarn\s+)?next(?:\s|$)/;
const NEXT_UNSUPPORTED = 'Next.js live preview is not supported in this release; scanning stays static. Live Before/After needs a Vite or Nx-Vite app.';
const SCRIPT_NAME = /^[-\w:]+$/;
const LOOPBACK_ORIGIN = /^http:\/\/127\.0\.0\.1:(\d{1,5})$/;

function unsupported(code: string, message: string): PreviewEligibility {
  return { eligible: false, failure: { code, message } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A regular (non-symlink) file whose name is a Vite config and whose content imports `vite`. */
async function isViteConfigFile(root: string, relativePath: string): Promise<boolean> {
  if (!VITE_CONFIG_NAME.test(basename(relativePath))) return false;
  const path = join(root, relativePath);
  try {
    if (!(await lstat(path)).isFile()) return false;
    return VITE_IMPORT.test(await readFile(path, 'utf8'));
  } catch {
    return false;
  }
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
    if (typeof viteConfig !== 'string' || viteConfig.includes('..') || isAbsolute(viteConfig)) {
      return unsupported('PREVIEW_UNSUPPORTED_BUILD_TOOL', `Application "${application}" needs a Vite config file inside the project.`);
    }
    if (NEXT_NAME.test(basename(viteConfig))) return unsupported('PREVIEW_UNSUPPORTED_BUILD_TOOL', NEXT_UNSUPPORTED);
    if (!(await isViteConfigFile(root, viteConfig))) {
      return unsupported('PREVIEW_UNSUPPORTED_BUILD_TOOL', `Application "${application}" needs a Vite config (vite.config.js, .mjs or .ts) that imports "vite".`);
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
      const script = packageScripts[startupScript];
      if (typeof script !== 'string') {
        return unsupported('PREVIEW_STARTUP_SCRIPT_MISSING', `package.json has no "${startupScript}" script for application "${application}".`);
      }
      if (NEXT_COMMAND.test(script)) return unsupported('PREVIEW_UNSUPPORTED_BUILD_TOOL', NEXT_UNSUPPORTED);
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

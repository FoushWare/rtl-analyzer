import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decidePreviewConsent, inspectPreviewProject, PREVIEW_STATES } from '../src/preview-orchestrator.js';

async function project(config: unknown, scripts: Record<string, string> = { dev: 'vite' }, withVite = false) {
  const root = await mkdtemp(join(tmpdir(), 'rtl-preview-orchestrator-'));
  if (config !== undefined) await writeFile(join(root, 'rtl-preview.config.json'), typeof config === 'string' ? config : JSON.stringify(config));
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts }));
  if (withVite) {
    await mkdir(join(root, 'node_modules', 'vite', 'bin'), { recursive: true });
    await writeFile(join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '');
  }
  return root;
}

const validConfig = (application: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  applications: {
    dashboard: { viteConfig: 'vite.config.mjs', entry: 'src/main.jsx', originalOrigin: 'http://127.0.0.1:4236', readySelector: '#dashboard', dataAdapter: 'none', startupScript: 'dev', routes: [], ...application },
  },
});

const noConsent = { interactive: false, ask: async () => 'y', write: () => undefined };

describe('preview states', () => {
  it('defines the four explicit states', () => {
    expect([...PREVIEW_STATES]).toEqual(['starting', 'ready', 'unsupported', 'startup_failed']);
  });
});

describe('inspectPreviewProject', () => {
  it('reports a missing preview configuration as unsupported, not a startup failure', async () => {
    const result = await inspectPreviewProject(await project(undefined));
    expect(result).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_CONFIGURATION_MISSING' } });
  });

  it('reports invalid JSON and wrong schema versions as unsupported configuration', async () => {
    expect(await inspectPreviewProject(await project('{'))).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_CONFIGURATION_INVALID' } });
    expect(await inspectPreviewProject(await project({ ...validConfig(), schemaVersion: 2 }))).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_CONFIGURATION_INVALID' } });
  });

  it('rejects non-Vite build tools and non-loopback origins', async () => {
    expect(await inspectPreviewProject(await project(validConfig({ viteConfig: 'next.config.mjs.json' })))).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_UNSUPPORTED_BUILD_TOOL' } });
    expect(await inspectPreviewProject(await project(validConfig({ originalOrigin: 'http://example.test:4236' })))).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_CONFIGURATION_INVALID' } });
  });

  it('reports a configured script that package.json does not define', async () => {
    const result = await inspectPreviewProject(await project(validConfig({ startupScript: 'serve' }), { dev: 'vite' }));
    expect(result).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_STARTUP_SCRIPT_MISSING' } });
  });

  it('requires the project Vite binary when no startup script is configured', async () => {
    const withoutVite = await inspectPreviewProject(await project(validConfig({ startupScript: undefined })));
    expect(withoutVite).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_VITE_NOT_INSTALLED' } });
    const withVite = await inspectPreviewProject(await project(validConfig({ startupScript: undefined }), {}, true));
    expect(withVite.eligible).toBe(true);
  });

  it('accepts a verified Vite configuration with a startup script without starting anything', async () => {
    const result = await inspectPreviewProject(await project(validConfig()));
    expect(result).toMatchObject({ eligible: true, applications: [{ application: 'dashboard', port: 4236, startupScript: 'dev' }] });
    if (!result.eligible) throw new Error('expected eligible');
    expect(result.commands[0]).toContain('npm run dev');
  });

  it('rejects duplicate ports across applications', async () => {
    const config = { schemaVersion: 1, applications: { a: validConfig().applications.dashboard, b: validConfig().applications.dashboard } };
    expect(await inspectPreviewProject(await project(config))).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_CONFIGURATION_INVALID' } });
  });
});

describe('decidePreviewConsent', () => {
  const eligible = { eligible: true as const, applications: [], commands: ['npm run dev -- --port 4236'] };

  it('approves only through explicit authorization or a typed yes', async () => {
    expect(await decidePreviewConsent(eligible, { ...noConsent, authorized: true })).toEqual({ approved: true, source: 'flag' });
    expect(await decidePreviewConsent(eligible, { interactive: true, ask: async () => 'yes', write: () => undefined })).toEqual({ approved: true, source: 'prompt' });
  });

  it('declines by default in an interactive prompt and shows the exact command first', async () => {
    const lines: string[] = [];
    const decision = await decidePreviewConsent(eligible, { interactive: true, ask: async () => '', write: line => lines.push(line) });
    expect(decision).toMatchObject({ approved: false, failure: { code: 'PREVIEW_DECLINED' } });
    expect(lines.join('\n')).toContain('npm run dev -- --port 4236');
  });

  it('never prompts or runs scripts when non-interactive without authorization', async () => {
    let asked = false;
    const decision = await decidePreviewConsent(eligible, { interactive: false, ask: async () => { asked = true; return 'yes'; }, write: () => undefined });
    expect(asked).toBe(false);
    expect(decision).toMatchObject({ approved: false, failure: { code: 'PREVIEW_APPROVAL_REQUIRED' } });
  });
});

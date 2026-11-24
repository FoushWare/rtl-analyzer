import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decidePreviewConsent, inspectPreviewProject, PREVIEW_STATES, startupNotice } from '../src/preview-orchestrator.js';

async function project(config: unknown, scripts: Record<string, string> = { dev: 'vite' }, withVite = false) {
  const root = await mkdtemp(join(tmpdir(), 'rtl-preview-orchestrator-'));
  if (config !== undefined) await writeFile(join(root, 'rtl-preview.config.json'), typeof config === 'string' ? config : JSON.stringify(config));
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'fixture', scripts }));
  // A real Vite config is part of the contract: eligibility reads the file, not just its name.
  await writeFile(join(root, 'vite.config.mjs'), "import { defineConfig } from 'vite';\nexport default defineConfig({});\n");
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

  it('approves by default in an interactive terminal, without printing anything itself', async () => {
    expect(await decidePreviewConsent(eligible, { interactive: true })).toEqual({ approved: true, source: 'default' });
  });

  it('records the compatibility flag as an explicit authorization', async () => {
    expect(await decidePreviewConsent(eligible, { authorized: true, interactive: false })).toEqual({ approved: true, source: 'flag' });
  });

  it('needs explicit approval in non-interactive runs (CI, pipes)', async () => {
    const decision = await decidePreviewConsent(eligible, { interactive: false });
    expect(decision).toMatchObject({ approved: false, failure: { code: 'PREVIEW_APPROVAL_REQUIRED' } });
  });

  it('runs no project script when the user opts out with --no-project-scripts', async () => {
    const decision = await decidePreviewConsent(eligible, { optOut: true, interactive: true });
    expect(decision).toMatchObject({ approved: false, failure: { code: 'PREVIEW_DISABLED' } });
  });

  it('builds the startup notice with the exact command and the opt-out hint', () => {
    const lines = startupNotice(['npm run dev -- --port 4236']);
    expect(lines.join('\n')).toContain('npm run dev -- --port 4236');
    expect(lines.at(-1)).toBe('Use --no-project-scripts to skip this.');
  });
});

/** Copies the Bilingual Storefront preview contract (Next.js config, `next dev` script) into a temp project. */
async function bilingualProject(nextConfigSource = "const nextConfig = { reactStrictMode: true };\nexport default nextConfig;\n", script = 'next dev --hostname 127.0.0.1 --port 4245') {
  const root = await mkdtemp(join(tmpdir(), 'rtl-bilingual-gate-'));
  // Resolved from this test module (tools/rtl-scanner/tests), so it does not depend on the runner's working directory.
  const exampleConfig = fileURLToPath(new URL('../../../examples/bilingual-storefront/rtl-preview.config.json', import.meta.url));
  const config = JSON.parse(await readFile(exampleConfig, 'utf8'));
  await writeFile(join(root, 'rtl-preview.config.json'), JSON.stringify(config));
  await writeFile(join(root, 'next.config.mjs'), nextConfigSource);
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'bilingual', scripts: { dev: script } }));
  return root;
}

describe('Vite eligibility is decided from real Vite configuration (Next.js is never eligible)', () => {
  it('rejects the Bilingual Storefront Next.js config and its next dev script as unsupported, not eligible', async () => {
    const result = await inspectPreviewProject(await bilingualProject());
    expect(result).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_UNSUPPORTED_BUILD_TOOL' } });
    if (result.eligible) throw new Error('Next.js must not be eligible for live preview');
    expect(result.failure.message).toMatch(/Next\.js/);
    expect(result.failure.message).toMatch(/static/);
  });

  it('rejects a script that runs next even when the config is named like a Vite config', async () => {
    const root = await bilingualProject();
    await writeFile(join(root, 'vite.config.mjs'), "import { defineConfig } from 'vite';\nexport default defineConfig({});\n");
    const config = JSON.parse(await readFile(join(root, 'rtl-preview.config.json'), 'utf8'));
    config.applications.storefront.viteConfig = 'vite.config.mjs';
    await writeFile(join(root, 'rtl-preview.config.json'), JSON.stringify(config));
    const result = await inspectPreviewProject(root);
    expect(result).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_UNSUPPORTED_BUILD_TOOL' } });
  });

  it('rejects a file named vite.config that does not import vite', async () => {
    const root = await project(validConfig());
    await writeFile(join(root, 'vite.config.mjs'), 'export default { plugins: [] };\n');
    expect(await inspectPreviewProject(root)).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_UNSUPPORTED_BUILD_TOOL' } });
  });

  it('rejects a missing viteConfig file', async () => {
    const root = await project(validConfig({ viteConfig: 'missing.vite.config.mjs' }));
    expect(await inspectPreviewProject(root)).toMatchObject({ eligible: false, failure: { code: 'PREVIEW_UNSUPPORTED_BUILD_TOOL' } });
  });

  it('keeps a valid Vite configuration eligible, including an Nx-style nested app config', async () => {
    const root = await project(validConfig());
    expect((await inspectPreviewProject(root)).eligible).toBe(true);
    const nested = await mkdtemp(join(tmpdir(), 'rtl-nx-gate-'));
    await mkdir(join(nested, 'apps', 'storefront'), { recursive: true });
    await writeFile(join(nested, 'apps', 'storefront', 'vite.config.mjs'), "import { defineConfig } from 'vite';\nexport default defineConfig({});\n");
    await writeFile(join(nested, 'package.json'), JSON.stringify({ name: 'nx', scripts: { 'dev:storefront': 'nx serve storefront' } }));
    const nxConfig = { schemaVersion: 1, applications: { storefront: { viteConfig: 'apps/storefront/vite.config.mjs', entry: 'apps/storefront/src/main.tsx', originalOrigin: 'http://127.0.0.1:4226', readySelector: '#root', dataAdapter: 'none', startupScript: 'dev:storefront', routes: [] } } };
    await writeFile(join(nested, 'rtl-preview.config.json'), JSON.stringify(nxConfig));
    expect(await inspectPreviewProject(nested)).toMatchObject({ eligible: true });
  });

  it('never accepts a config path that escapes the project', async () => {
    const root = await project(validConfig({ viteConfig: '../vite.config.mjs' }));
    expect((await inspectPreviewProject(root)).eligible).toBe(false);
  });
});

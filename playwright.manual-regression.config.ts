import { defineConfig } from '@playwright/test';
import { dashboard, project, repo } from './tests/e2e/portable-fixture.mjs';

export default defineConfig({
  testDir: './tests/e2e',
  metadata: { portableFixtureRoot: project },
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } },
  webServer: [
    {
      command: 'npx vite --config apps/invoicing/vite.config.ts --host 127.0.0.1 --port 4200 --strictPort',
      cwd: project,
      url: 'http://127.0.0.1:4200/invoices',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node tools/rtl-scanner/tests/serve-dashboard-harness.mjs',
      cwd: repo,
      env: { ...process.env, RTL_E2E_DASHBOARD: dashboard },
      url: 'http://127.0.0.1:4320/rtl-report-dashboard.html',
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});

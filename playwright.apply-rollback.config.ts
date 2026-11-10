import { defineConfig } from '@playwright/test';
import { dashboard, project, repo, state } from './tests/e2e/portable-fixture.mjs';
export default defineConfig({ testDir: './tests/e2e', metadata: { portableFixtureRoot: project }, fullyParallel: false, workers: 1, timeout: 180_000, use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } }, webServer: [
  { command: `RTL_PROJECT_ROOT="${project}" RTL_REVIEW_STORE_PATH="${state}/review-records-v1.json" RTL_EVIDENCE_STORE_PATH="${state}/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="${state}/manual-changes-v1.json" RTL_SCAN_MANIFEST_STORE_PATH="${state}/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="${state}/apply-audit-v1.json" RTL_APPLY_BACKUP_ROOT="${state}/backups" exec node "${repo}/dist/tools/rtl-scanner/preview-companion.js"`, url: 'http://127.0.0.1:4318/health', reuseExistingServer: false, timeout: 30_000 },
  { command: `node "${repo}/node_modules/vite/bin/vite.js" --config "${repo}/apps/invoicing/vite.config.ts" --host 127.0.0.1 --port 4200 --strictPort`, cwd: project, url: 'http://127.0.0.1:4200/invoices', reuseExistingServer: false, timeout: 30_000 },
  { command: `python3 -m http.server 4320 --bind 127.0.0.1`, cwd: dashboard, url: 'http://127.0.0.1:4320/rtl-report-dashboard.html', reuseExistingServer: false, timeout: 30_000 },
] });

import { defineConfig } from '@playwright/test';
import { dashboard, project, repo, state } from './tests/e2e/portable-fixture.mjs';
import { writePhase5Dashboard, writePhase5ProjectFixture } from './tests/e2e/phase5-fixture.mjs';
writePhase5Dashboard(dashboard);
writePhase5ProjectFixture(project);
export default defineConfig({ testDir: './tests/e2e', fullyParallel: false, timeout: 120_000, use: { browserName: 'chromium' }, webServer: [
  { command: `RTL_PROJECT_ROOT="${project}" RTL_REVIEW_STORE_PATH="${state}/review-records-v1.json" RTL_EVIDENCE_STORE_PATH="${state}/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="${state}/manual-changes-v1.json" RTL_SCAN_MANIFEST_STORE_PATH="${state}/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="${state}/apply-audit-v1.json" RTL_APPLY_BACKUP_ROOT="${state}/backups" node "${repo}/dist/tools/rtl-scanner/preview-companion.js"`, url: 'http://127.0.0.1:4318/health', reuseExistingServer: false, timeout: 30_000 },
  { command: 'python3 -m http.server 4320 --bind 127.0.0.1', cwd: dashboard, url: 'http://127.0.0.1:4320/rtl-report-dashboard.html', reuseExistingServer: false, timeout: 30_000 },
] });

import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { expect, test } from '@playwright/test';

const port = 4319;
const findingId = 'RTL.BIDI.ISOLATION:741d2ce2aec3a86cf2db37ea';
const source = 'apps/invoicing/src/components/InvoiceTable.tsx';
const dashboard = 'http://127.0.0.1:4320/rtl-report-dashboard.html?finding=' + encodeURIComponent(findingId);
const identity = { findingId, sourcePath: source, inputDigest: '3011f559425f764e053dd89b48a060b24d79ce1d9a3eca068fb5e308fb81608a', policyDigest: 'fc82bc0137f0800c3c6818b55a14ef2ac9abaeb1b018d503834d9899183abf49', schemaVersion: 2 };
const health = () => new Promise<any>((resolve, reject) => { const r = httpRequest({ host: '127.0.0.1', port, path: '/health' }, x => { let b = ''; x.on('data', c => { b += c; }); x.on('end', () => x.statusCode === 200 ? resolve(JSON.parse(b)) : reject()); }); r.on('error', reject); r.end(); });
const waitHealth = async () => { for (let i = 0; i < 150; i++) { try { return await health(); } catch { await new Promise(r => setTimeout(r, 100)); } } throw new Error('COMPANION_NOT_READY'); };
const start = (root: string, state: string) => spawn(process.execPath, ['dist/tools/rtl-scanner/preview-companion.js'], { cwd: process.cwd(), env: { ...process.env, RTL_PREVIEW_PORT: String(port), RTL_PROJECT_ROOT: root, RTL_REVIEW_STORE_PATH: join(state, 'review-records-v1.json'), RTL_EVIDENCE_STORE_PATH: join(state, 'review-evidence-v1.json'), RTL_MANUAL_CHANGE_STORE_PATH: join(state, 'manual-changes-v1.json'), RTL_SCAN_MANIFEST_STORE_PATH: join(state, 'scan-manifests-v1.json'), RTL_AUDIT_STORE_PATH: join(state, 'apply-audit-v1.json'), RTL_APPLY_BACKUP_ROOT: join(state, 'backups') }, stdio: 'ignore' });
const stop = async (p: ChildProcess) => { if (p.exitCode !== null) return; const exited = new Promise<void>(r => p.once('exit', () => r())); p.kill('SIGTERM'); await exited; };
const digest = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

test('persisted rollback conflict projects Failed', async ({ page }, testInfo) => {
  const workspace = mkdtempSync(join(tmpdir(), 'rtl-failed-')); const root = join(workspace, 'project'); const state = join(workspace, 'state');
  const fixtureRoot = testInfo.config.metadata?.portableFixtureRoot; if (typeof fixtureRoot !== 'string' || !fixtureRoot) throw new Error('PORTABLE_FIXTURE_UNAVAILABLE');
  mkdirSync(join(state, 'backups'), { recursive: true }); cpSync(fixtureRoot, root, { recursive: true });
  const sourceFile = join(root, source); const originalHash = digest(sourceFile); const child = start(root, state);
  const readLifecycle = () => page.evaluate(async x => (await fetch('http://127.0.0.1:4319/review/lifecycle?' + new URLSearchParams(x as any))).json(), identity);
  const readAudit = () => page.evaluate(async () => (await fetch('http://127.0.0.1:4319/review/audit?sourcePath=apps%2Finvoicing%2Fsrc%2Fcomponents%2FInvoiceTable.tsx')).json());
  try {
    let rollbackStatus = 0; let rollbackBody = '';
    page.on('response', async response => {
      if (response.request().method() === 'POST' && response.url().endsWith('/review/rollback')) {
        rollbackStatus = response.status(); rollbackBody = await response.text();
        console.log(`ROLLBACK_RESPONSE ${rollbackStatus} ${rollbackBody}`);
      }
    });
    page.on('requestfailed', request => console.log(`REQUEST_FAILED ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`));
    await waitHealth(); await page.goto(dashboard); await expect(page.getByText('Codemod Dry Run')).toBeVisible();
    await page.getByRole('button', { name: 'Propose Candidate' }).click(); await expect(page.getByText(/Candidate session .* created/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Start Candidate Preview' }).click(); await expect(page.getByRole('button', { name: 'Open Candidate LTR Preview' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Analyze Transformation' }).click(); await expect(page.getByText('Analyzed: bidi-isolate-auto')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Apply to Candidate' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Apply to Candidate' }).click(); await expect(page.getByText('Candidate-applied patch')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Run Validation' }).click(); await expect(page.locator('.validation-state')).toHaveText('Passed', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Archive Evidence' }).click(); await expect(page.locator('.validation-state')).toHaveText('Evidence Archived', { timeout: 15_000 });
    await page.reload(); const review = page.locator('.review-workspace'); await expect(review).toContainText('Candidate Proposed', { timeout: 15_000 });
    await review.locator('textarea').fill('Failure lifecycle approval'); await review.locator('input').fill('validation-evidence'); await review.getByRole('button', { name: 'Mark Ready for Review' }).click(); await expect(review).toContainText('Ready for Review');
    page.on('dialog', d => d.accept()); await review.getByRole('button', { name: 'Approve' }).click(); await expect(review).toContainText('Approved', { timeout: 15_000 }); await expect(page.locator('.controlled-apply')).toContainText('Ready to Apply', { timeout: 15_000 });
    await page.locator('.controlled-apply').getByRole('button', { name: 'Apply Change' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Confirm Apply' }).click(); await expect(page.locator('.controlled-apply')).toContainText('Applied to Source', { timeout: 15_000 });
    expect(digest(sourceFile)).not.toBe(originalHash);
    writeFileSync(sourceFile, readFileSync(sourceFile, 'utf8') + '\n// disposable rollback conflict\n');
    await page.locator('.controlled-apply').getByRole('button', { name: 'Rollback Change' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Confirm Rollback' }).click();
    await expect.poll(() => rollbackStatus, { timeout: 15_000 }).toBe(409);
    expect(rollbackBody).toContain('ROLLBACK_CONFLICT');
    await expect(page.locator('.controlled-apply')).toContainText('Recovery required', { timeout: 15_000 });
    const failedAudit = await readAudit(); expect(failedAudit.events.at(-1).type).toBe('ROLLBACK_FAILED'); expect(failedAudit.events.at(-1).reason).toBe('CURRENT_SOURCE_CHANGED');
    const failedLifecycle = await readLifecycle(); expect(failedLifecycle.lifecycle).toBe('Failed');
    await page.reload(); await expect(page.locator('.lifecycle-state')).toHaveText('State: Failed', { timeout: 15_000 });
    await stop(child); const restarted = start(root, state);
    try { await waitHealth(); await page.reload(); await expect(page.locator('.lifecycle-state')).toHaveText('State: Failed', { timeout: 15_000 }); const recovered = await readAudit(); expect(recovered.events).toEqual(failedAudit.events); expect((await readLifecycle()).lifecycle).toBe('Failed'); } finally { await stop(restarted); }
  } finally { if (child.exitCode === null) await stop(child); }
});

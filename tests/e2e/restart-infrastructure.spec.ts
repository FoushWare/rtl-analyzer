import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { expect, test } from '@playwright/test';

const companionPort = 4319;
const fixtureSource = (testInfo: { config: { metadata?: Record<string, unknown> } }) => { const root = testInfo.config.metadata?.portableFixtureRoot; if (typeof root !== 'string' || !root) throw new Error('PORTABLE_FIXTURE_UNAVAILABLE'); return root; };
const dashboard = 'http://127.0.0.1:4320/rtl-report-dashboard.html';

function getHealth(): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port: companionPort, path: '/health' }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => response.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`HEALTH_${response.statusCode}`)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForHealth(): Promise<any> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try { return await getHealth(); } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error('COMPANION_READINESS_TIMEOUT');
}

function startCompanion(root: string, state: string): ChildProcess {
  return spawn(process.execPath, ['dist/tools/rtl-scanner/preview-companion.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RTL_PREVIEW_PORT: String(companionPort),
      RTL_PROJECT_ROOT: root,
      RTL_REVIEW_STORE_PATH: join(state, 'review-records-v1.json'),
      RTL_EVIDENCE_STORE_PATH: join(state, 'review-evidence-v1.json'),
      RTL_MANUAL_CHANGE_STORE_PATH: join(state, 'manual-changes-v1.json'),
      RTL_SCAN_MANIFEST_STORE_PATH: join(state, 'scan-manifests-v1.json'),
      RTL_AUDIT_STORE_PATH: join(state, 'apply-audit-v1.json'),
      RTL_APPLY_BACKUP_ROOT: join(state, 'backups'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function stopOwned(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null) return;
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  await Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error('COMPANION_SHUTDOWN_TIMEOUT')), 10_000))]);
}

test('restart infrastructure reconnects the same owned companion', async ({ page }, testInfo) => {
  const workspace = mkdtempSync(join(tmpdir(), 'rtl-restart-'));
  const root = join(workspace, 'project');
  const state = join(workspace, 'state');
  mkdirSync(state, { recursive: true });
  mkdirSync(join(state, 'backups'), { recursive: true });
  cpSync(fixtureSource(testInfo), root, { recursive: true });

  const sourceHash = createHash('sha256').update(readFileSync(join(root, 'apps/invoicing/src/components/InvoiceTable.tsx'))).digest('hex');
  const first = startCompanion(root, state);
  try {
    const before = await waitForHealth();
    expect(before.applicationOrigin).toBe('http://127.0.0.1:4200');
    await page.goto(dashboard);
    const firstHealth = await page.evaluate(async () => (await fetch('http://127.0.0.1:4319/health')).json());
    expect(firstHealth.ok).toBe(true);
    expect(firstHealth.service).toBe('rtl-preview-companion');
    await stopOwned(first);
    await expect.poll(() => getHealth().then(() => true).catch(() => false)).toBe(false);

    const second = startCompanion(root, state);
    try {
      const after = await waitForHealth();
      expect(after.applicationOrigin).toBe(before.applicationOrigin);
      await page.reload();
      const secondHealth = await page.evaluate(async () => (await fetch('http://127.0.0.1:4319/health')).json());
      expect(secondHealth.ok).toBe(true);
      expect(secondHealth.service).toBe(firstHealth.service);
      expect(createHash('sha256').update(readFileSync(join(root, 'apps/invoicing/src/components/InvoiceTable.tsx'))).digest('hex')).toBe(sourceHash);
    } finally {
      await stopOwned(second);
    }
  } finally {
    if (first.exitCode === null) await stopOwned(first);
  }
});

test('same records survive an owned companion restart', async ({ page }, testInfo) => {
  const workspace = mkdtempSync(join(tmpdir(), 'rtl-restart-journey-'));
  const root = join(workspace, 'project');
  const state = join(workspace, 'state');
  mkdirSync(state, { recursive: true });
  mkdirSync(join(state, 'backups'), { recursive: true });
  cpSync(fixtureSource(testInfo), root, { recursive: true });
  const sourceFile = join(root, 'apps/invoicing/src/components/InvoiceTable.tsx');
  const hash = () => createHash('sha256').update(readFileSync(sourceFile)).digest('hex');
  const originalHash = hash();
  const identity = { findingId: 'RTL.BIDI.ISOLATION:741d2ce2aec3a86cf2db37ea', sourcePath: 'apps/invoicing/src/components/InvoiceTable.tsx', inputDigest: '3011f559425f764e053dd89b48a060b24d79ce1d9a3eca068fb5e308fb81608a', policyDigest: 'fc82bc0137f0800c3c6818b55a14ef2ac9abaeb1b018d503834d9899183abf49', schemaVersion: 2 };
  const readRecords = () => page.evaluate(async identity => (await fetch('http://127.0.0.1:4319/review/records?' + new URLSearchParams(identity as any))).json(), identity);
  const readAudit = () => page.evaluate(async () => (await fetch('http://127.0.0.1:4319/review/audit?sourcePath=apps%2Finvoicing%2Fsrc%2Fcomponents%2FInvoiceTable.tsx')).json());
  const readLifecycle = () => page.evaluate(async identity => (await fetch('http://127.0.0.1:4319/review/lifecycle?' + new URLSearchParams(identity as any))).json(), identity);
  const child = startCompanion(root, state);
  try {
    await waitForHealth();
    await page.goto(dashboard + '?finding=' + encodeURIComponent(identity.findingId));
    await expect(page.getByText('Codemod Dry Run')).toBeVisible();
    await page.getByRole('button', { name: 'Propose Candidate' }).click();
    await expect(page.getByText(/Candidate session .* created/)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Start Candidate Preview' }).click();
    await expect(page.getByRole('button', { name: 'Open Candidate LTR Preview' })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Analyze Transformation' }).click();
    await expect(page.getByText('Analyzed: bidi-isolate-auto')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Apply to Candidate' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Apply to Candidate' }).click();
    await expect(page.getByText('Candidate-applied patch')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Run Validation' }).click();
    await expect(page.locator('.validation-state')).toHaveText('Passed', { timeout: 120_000 });
    await page.getByRole('button', { name: 'Archive Evidence' }).click();
    await expect(page.locator('.validation-state')).toHaveText('Evidence Archived', { timeout: 15_000 });
    await page.reload();
    await expect(page.locator('.review-workspace')).toContainText('Candidate Proposed', { timeout: 15_000 });
    const workspacePanel = page.locator('.review-workspace');
    await workspacePanel.locator('textarea').fill('Restart acceptance approval');
    await workspacePanel.locator('input').fill('validation-evidence');
    await workspacePanel.getByRole('button', { name: 'Mark Ready for Review' }).click();
    await expect(workspacePanel).toContainText('Ready for Review', { timeout: 15_000 });
    page.on('dialog', dialog => dialog.accept());
    await workspacePanel.getByRole('button', { name: 'Approve' }).click();
    await expect(workspacePanel).toContainText('Approved', { timeout: 15_000 });
    await expect(page.locator('.controlled-apply')).toContainText('Ready to Apply', { timeout: 15_000 });
    await page.locator('.controlled-apply').getByRole('button', { name: 'Apply Change' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm Apply' }).click();
    await expect(page.locator('.controlled-apply')).toContainText('Applied to Source', { timeout: 15_000 });
    const appliedHash = hash();
    expect(appliedHash).not.toBe(originalHash);
    await page.locator('.controlled-apply').getByRole('button', { name: 'Rollback Change' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm Rollback' }).click();
    await expect(page.locator('.controlled-apply')).toContainText('Rolled Back', { timeout: 15_000 });
    expect(hash()).toBe(originalHash);
    const beforeRecords = await readRecords();
    const beforeAudit = await readAudit();
    const beforeLifecycle = await readLifecycle();
    expect(beforeRecords.record.status).toBe('Approved');
    expect(beforeAudit.events.map((event: any) => event.type)).toEqual(['APPLIED', 'ROLLED_BACK']);
    expect(beforeLifecycle.lifecycle).toBe('Rolled Back');
    const beforeAuditIds = beforeAudit.events.map((event: any) => event.auditId);
    await stopOwned(child);
    const restarted = startCompanion(root, state);
    try {
      await waitForHealth();
      await page.reload();
      await expect(page.locator('.audit-history')).toContainText('APPLIED', { timeout: 15_000 });
      await expect(page.locator('.audit-history')).toContainText('ROLLED_BACK');
      const afterRecords = await readRecords();
      const afterAudit = await readAudit();
      const afterLifecycle = await readLifecycle();
      expect(afterRecords.record).toEqual(beforeRecords.record);
      expect(afterAudit.events).toEqual(beforeAudit.events);
      expect(afterAudit.events.map((event: any) => event.auditId)).toEqual(beforeAuditIds);
      expect(afterLifecycle.lifecycle).toBe('Rolled Back');
      expect(hash()).toBe(originalHash);
      expect(appliedHash).not.toBe(originalHash);
    } finally {
      await stopOwned(restarted);
    }
  } finally {
    if (child.exitCode === null) await stopOwned(child);
  }
});

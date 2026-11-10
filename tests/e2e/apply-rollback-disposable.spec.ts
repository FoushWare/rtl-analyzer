import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const sourcePath = 'apps/invoicing/src/components/InvoiceTable.tsx';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

test('disposable candidate validation persists through reload', async ({ page }, testInfo) => {
  const fixtureRoot = testInfo.config.metadata?.portableFixtureRoot;
  if (typeof fixtureRoot !== 'string' || !fixtureRoot) throw new Error('PORTABLE_FIXTURE_UNAVAILABLE');
  const sourceFile = `${fixtureRoot}/${sourcePath}`;
  let validationPayload: any;
  let evidencePayload: any;
  let applyReceipt: any;
  let applyStatus = 0;
  let rollbackStatus = 0;
  page.on('response', async response => {
    if (!response.url().includes('127.0.0.1:4318')) return;
    const body = await response.text().catch(() => '');
    console.log('COMPANION_RESPONSE', response.request().method(), response.status(), response.url(), body.slice(0, 240));
    if (response.url().match(/\/review\/sessions\/[^/]+\/validate$/) && response.request().method() === 'POST') {
      validationPayload = JSON.parse(body);
    }
    if (response.url().includes('/review/evidence') && response.request().method() === 'GET' && body.includes('snapshots')) {
      evidencePayload = JSON.parse(body);
    }
    if (response.url().endsWith('/review/apply') && response.request().method() === 'POST') {
      applyStatus = response.status();
      if (response.ok()) applyReceipt = JSON.parse(body);
    }
    if (response.url().endsWith('/review/rollback') && response.request().method() === 'POST') rollbackStatus = response.status();
  });
  page.on('console', message => console.log('BROWSER_CONSOLE', message.type(), message.text()));
  await page.goto('http://127.0.0.1:4320/rtl-report-dashboard.html?finding=RTL.BIDI.ISOLATION%3A741d2ce2aec3a86cf2db37ea');
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
  const validationState = page.locator('.validation-state');
  await expect(validationState).toHaveText(/^(Passed|Failed|Blocked)$/, { timeout: 120_000 });
  await expect(page.locator('.validation-output')).toContainText('Scanner before: finding present');
  await expect(page.locator('.validation-output')).toContainText('Scanner after: finding absent');
  await expect(page.locator('.validation-output')).toContainText('html.dir=ltr');
  await expect(page.locator('.validation-output')).toContainText('html.dir=rtl');
  expect(validationPayload?.result?.state).toMatch(/^(Passed|Failed|Blocked)$/);
  expect(validationPayload.result.patch.path).toBe('apps/invoicing/src/components/InvoiceTable.tsx');
  expect(validationPayload.result.originalSourceSha256).toBe('fc53fd82d9334231a1ed6e704b72193af3c9d1f1503d4a240f62c016d3bd6c1c');
  expect(validationPayload.result.candidateSourceSha256).not.toBe(validationPayload.result.originalSourceSha256);
  expect(validationPayload.result.scannerBefore.findingPresent).toBe(true);
  expect(validationPayload.result.scannerAfter.findingPresent).toBe(false);
  expect(validationPayload.result.browserDomValidation).toEqual(expect.arrayContaining([
    'original-ltr:html.dir=ltr',
    'original-rtl:html.dir=rtl',
    'candidate-ltr:html.dir=ltr',
    'candidate-rtl:html.dir=rtl',
  ]));
  await expect(validationState).toHaveText('Passed');
  await page.getByRole('button', { name: 'Archive Evidence' }).click();
  await expect(validationState).toHaveText('Evidence Archived', { timeout: 15_000 });
  await page.reload();
  await expect(page.locator('.archived-evidence')).toContainText('Archived Evidence', { timeout: 15_000 });
  await expect(page.locator('.archived-evidence')).toContainText('Scanner before: finding present');
  await expect(page.locator('.archived-evidence')).toContainText(validationPayload.result.originalSourceSha256);
  await expect(page.locator('.archived-evidence')).toContainText(validationPayload.result.candidateSourceSha256);
  await expect.poll(() => evidencePayload?.snapshots?.length ?? 0).toBeGreaterThan(0);
  expect(evidencePayload.snapshots[0].findingId).toBe('RTL.BIDI.ISOLATION:741d2ce2aec3a86cf2db37ea');
  expect(evidencePayload.snapshots[0].sourcePath).toBe(validationPayload.result.patch.path);
  expect(evidencePayload.snapshots[0].originalSourceSha256).toBe(validationPayload.result.originalSourceSha256);
  expect(evidencePayload.snapshots[0].candidateSourceSha256).toBe(validationPayload.result.candidateSourceSha256);

  const originalText = readFileSync(sourceFile, 'utf8');
  const originalHash = digest(originalText);
  expect(originalHash).toBe(validationPayload.result.originalSourceSha256);
  expect(sourceFile.startsWith(fixtureRoot + '/')).toBe(true);

  const workspace = page.locator('.review-workspace');
  await workspace.locator('textarea').fill('Validated disposable candidate for controlled apply acceptance');
  await workspace.locator('input').fill('validation-evidence');
  await workspace.getByRole('button', { name: 'Mark Ready for Review' }).click();
  await expect(workspace).toContainText('Persisted review status: Ready for Review', { timeout: 15_000 });
  page.on('dialog', dialog => dialog.accept());
  await workspace.getByRole('button', { name: 'Approve' }).click();
  await expect(workspace).toContainText('Persisted review status: Approved', { timeout: 15_000 });

  const applyPanel = page.locator('.controlled-apply');
  await expect(applyPanel).toContainText('Ready to Apply', { timeout: 15_000 });
  await expect(applyPanel).toContainText(validationPayload.result.candidateSourceSha256);
  await applyPanel.getByRole('button', { name: 'Apply Change' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm Apply' }).click();
  await expect(applyPanel).toContainText('Applied to Source', { timeout: 15_000 });
  await expect.poll(() => applyStatus).toBe(200);
  expect(applyReceipt?.receipt?.appliedSha256).toBe(validationPayload.result.candidateSourceSha256);
  expect(digest(readFileSync(sourceFile, 'utf8'))).toBe(validationPayload.result.candidateSourceSha256);
  await expect(applyPanel).toContainText('APPLIED', { timeout: 15_000 });

  await applyPanel.getByRole('button', { name: 'Rollback Change' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm Rollback' }).click();
  await expect(applyPanel).toContainText('Rolled Back', { timeout: 15_000 });
  expect(rollbackStatus).toBe(200);
  expect(digest(readFileSync(sourceFile, 'utf8'))).toBe(originalHash);
  await expect(applyPanel).toContainText('ROLLED_BACK', { timeout: 15_000 });
  await page.reload();
  await expect(page.locator('.audit-history')).toContainText('APPLIED', { timeout: 15_000 });
  await expect(page.locator('.audit-history')).toContainText('ROLLED_BACK');
  await expect(page.locator('.controlled-apply')).toContainText('ROLLED_BACK');
});

import { expect, test } from '@playwright/test';
import { phase5Manifest } from './phase5-fixture.mjs';
test('renders authoritative progress and finding details after reload', async ({ page }) => {
  await page.goto('http://127.0.0.1:4320/rtl-report-dashboard.html');
  const manifest = phase5Manifest;
  const result = await page.evaluate(async manifest => { const r = await fetch('http://127.0.0.1:4318/review/rescan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ project: 'invoicing', manifest }) }); return r.status; }, manifest);
  expect(result).toBe(201);
  await page.reload();
  await expect(page.getByText('Total current findings: 2')).toBeVisible();
  await expect(page.getByText('Validated: 0 · Outstanding: 2')).toBeVisible();
  await expect(page.getByText(/Recommendations:.*Manual 1.*Assisted 1/)).toBeVisible();
  await expect(page.getByText(/Rescan:.*New 2/)).toBeVisible();
  await expect(page.getByText(/manual-1.*Pending.*New/)).toBeVisible();
  const progress = await page.evaluate(async () => (await fetch('http://127.0.0.1:4318/review/progress')).json());
  expect(progress.totalFindings).toBe(2);
  expect(progress.progressPercent).toBe(0);
  expect(progress.outstanding).toBe(2);
});

test('recovers authoritative progress after companion restart', async ({ page }) => {
  await page.goto('http://127.0.0.1:4320/rtl-report-dashboard.html');
  await expect(page.getByText('Total current findings: 2')).toBeVisible();
  const progress = await page.evaluate(async () => (await fetch('http://127.0.0.1:4318/review/progress')).json());
  expect(progress.totalFindings).toBe(2);
});

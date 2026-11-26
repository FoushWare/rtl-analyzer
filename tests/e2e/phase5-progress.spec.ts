import { expect, test } from '@playwright/test';
import { phase5Manifest } from './phase5-fixture.mjs';
import { readFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import { join } from 'node:path';
// Reads the per-run bootstrap secret from the companion's owner-only file. v0.6.2 writes no file and needs none.
const readCompanionBootstrap = (port: number): string | undefined => { try { return JSON.parse(readFileSync(join(tmpdir(), 'rtl-analyzer-auth-' + userInfo().uid, 'companion-' + port + '.json'), 'utf8')).bootstrap; } catch { return undefined; } };
// The page is served without a session here, so the test acts as a dashboard session: it mints a companion token with the
// per-run bootstrap secret, exactly as the CLI does, and presents that token like the dashboard page does.
async function sessionToken(): Promise<string> {
  const response = await fetch('http://127.0.0.1:4318/auth/session', { method: 'POST', headers: { 'x-rtl-companion-bootstrap': readCompanionBootstrap(4318) ?? '' } });
  return ((await response.json()) as { token: string }).token;
}
test('renders authoritative progress and finding details after reload', async ({ page }) => {
  await page.goto('http://127.0.0.1:4320/rtl-report-dashboard.html');
  const manifest = phase5Manifest;
  const token = await sessionToken();
  const result = await page.evaluate(async ({ manifest, token }) => { const r = await fetch('http://127.0.0.1:4318/review/rescan', { method: 'POST', headers: { 'content-type': 'application/json', 'x-rtl-companion-session': token }, body: JSON.stringify({ project: 'invoicing', manifest }) }); return r.status; }, { manifest, token });
  expect(result).toBe(201);
  await page.reload();
  await expect(page.getByText('Total current findings: 2')).toBeVisible();
  await expect(page.getByText('Validated: 0 · Outstanding: 2')).toBeVisible();
  await expect(page.getByText(/Recommendations:.*Manual 1.*Assisted 1/)).toBeVisible();
  await expect(page.getByText(/Rescan:.*New 2/)).toBeVisible();
  await expect(page.getByText(/manual-1.*Pending.*New/)).toBeVisible();
  const progress = await page.evaluate(async token => (await fetch('http://127.0.0.1:4318/review/progress', { headers: { 'x-rtl-companion-session': token } })).json(), await sessionToken());
  expect(progress.totalFindings).toBe(2);
  expect(progress.progressPercent).toBe(0);
  expect(progress.outstanding).toBe(2);
});

test('recovers authoritative progress after companion restart', async ({ page }) => {
  await page.goto('http://127.0.0.1:4320/rtl-report-dashboard.html');
  await expect(page.getByText('Total current findings: 2')).toBeVisible();
  const progress = await page.evaluate(async token => (await fetch('http://127.0.0.1:4318/review/progress', { headers: { 'x-rtl-companion-session': token } })).json(), await sessionToken());
  expect(progress.totalFindings).toBe(2);
});

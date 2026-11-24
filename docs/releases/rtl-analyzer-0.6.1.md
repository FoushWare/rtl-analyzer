# RTL Analyzer 0.6.1 — Live Preview reliability and loading

## Changes

- **Before/After load on their own.** Each panel shows its own loading status (starting the dev server, waiting for the application, loading the original, preparing the modified preview, rendering). Before renders as soon as it is ready; After renders when its own preview is ready. Nothing needs a page reload.
- **Readiness is reconciled.** When the preview becomes ready, the page re-requests the source context, the review workflow, and the selected finding's routes. A review started while the preview was still starting is started again automatically.
- **Live reads stay responsive during startup.** The companion no longer holds its exclusive lock for the whole original start.
- **Startup time.** The dev server has 60 seconds by default. Set `startupTimeoutMs` (10000 to 180000) per application in `rtl-preview.config.json`. The same budget applies to the candidate preview.
- **Honest status text.** While starting: "Starting live preview". After a failure: the cause and Retry Preview / Continue with Report / Copy Diagnostics. The source-blocked and "historical" wording shows only for real failures.
- **Cleanup.** The companion that the CLI starts is stopped when the run ends; a companion with a start in progress is not shut down by its idle timer.
- **Diagnostics** (from 0.6.1 candidate work): bounded, redacted dev-server output with exit code, signal and wait time; classified failures.

## Verification

Browser acceptance against the packaged 0.6.1 candidate (Playwright Chromium, disposable Foundations Lab copies, no manual reloads). Evidence: `docs/verification/live-preview-stability-v0.6.1-2026-11-24.md`.

- Normal startup (3 runs): Before 4.2–5.3 s, After 5.2–7.1 s.
- Cold start, 12 s delay (3 runs): Before 16–19 s, After 30–32 s.
- Dev server delayed 35 s and 45 s: Before 39 s and 50 s; After 76 s and 97 s.
- After delayed 20 s (3 runs): Before 4 s, After 26 s.
- Before delayed 20 s: Before 27 s, After 29 s.
- After iframe HTML delayed 15 s: After 51 s.
- Page opened after readiness: both ready within 1 s.
- Rapid navigation (8 findings): correct finding and routes, no stale panels.
- Failure, then Retry Preview in the same session: recovers, no reload.
- Exceeded `startupTimeoutMs`: "did not respond in time … within 15 seconds".
- Missing dependencies: setup dialog, install, Retry: recovers.
- Approve, Validate, Apply, Rollback: source SHA-256 `929268…` → `76a9c2…` → `929268…`.
- Process cleanup after each run: no leftover listeners on 4216, 4318, 4320, 4202.
- Non-interactive: `--no-project-scripts` and missing `--approve-project-scripts` both start nothing.

## Known limitations

- Apply and Rollback still reload the page once after the change, as before this release.
- The implementation's lint job fails on pre-existing debt (345 errors across the e2e specs, already failing on the base branch).
- Windows CI runs on the release PR; no Windows browser acceptance was run locally.

# Live Preview stability (v0.6.1) — in progress, not released

**Status 2026-11-24: code and unit verification complete for Phases 1–4 and 6; browser acceptance (Phase 7) not run; nothing pushed, merged, tagged or published.**

## Baseline (verified in this workspace before edits)

- origin/main `761a5bd`; implementation pin `819b733` on `codex/companion-session-leases`.
- `npm run rtl:scan:typecheck`: pass. `npm run rtl:scan:test`: 524 passed. `npm run rtl:overlay:test`: 442 passed.
- Latest release v0.6.0 (GitHub and npm `latest`). Open milestones: v0.5.0 (2 open), v0.6.0 (1 open), v0.7.0 (2 open). No v0.6.1 milestone exists yet.
- The implementation pin is not on the implementation repo's `main` (`910133c`); it is on `codex/companion-session-leases` without an open PR.

## Root causes

Reproduced without a browser (real dashboard client in jsdom, companion stubbed, session from `DashboardSession`):

- **Baseline `819b733`, page opened while the server starts:** after readiness the page still shows `REPORT SNAPSHOT · SOURCE UNVERIFIED` and `Source context blocked: fetch failed`; the source context is requested once and never again. Only a manual refresh clears it. This matches #34.
- **Baseline, Retry after a failed start:** after Retry succeeds, the same stale state remains.

Found and fixed during this work: the first version of the fix made the report wait for readiness, which left it blank while starting or after a failure. The baseline shows the report at once. The fix restores the immediate render.

From code, not yet reproduced in a browser:

- **Readiness (#34):** session state (`starting`/`ready`/`startup_failed`) reaches the page only through the overlay status bar's 1 s poll. The review client never reads it. Companion calls made while the server was still starting failed once and were never retried. Iframe status messages that arrived while `contextResolving` was set were ignored, and nothing asked again.
- **Diagnostics (#31):** the original dev server was started with `stdio: 'ignore'` (`runtime-process.ts`), so npm/Vite errors were discarded.
- **Recovery (#32):** the failure dialog had no classification, no copyable command, and no Copy Diagnostics.
- **Lifecycle:** a companion that spawned but never became ready was left running until its idle grace period, and a timed-out original runtime was left owned, so a retry could reuse it.

## Changes

Implementation (final pin `94a14e7`, three local commits on `fix/live-preview-stability-v0.6.1` on top of `819b733`; not pushed):

- `16aff63` startup evidence and readiness waiting; `42641eb` keep the report visible while starting; `94a14e7` readiness regression tests.

- Bounded 8 KiB capture of child stdout/stderr, ANSI stripped; redaction of URL credentials, bearer tokens, secret-named values, environment lines; home path shown as `~`.
- `OriginalPreviewStartupError` carries `reason` (exited / spawn-error / timeout), exit code, signal, spawn error code, command, startup script, project folder, port, wait time and redacted output. The stable code `ORIGINAL_PREVIEW_STARTUP_FAILED` is kept.
- A failed original start stops the runtime it owns and removes it from the owned map.
- Companion error responses carry `diagnostics`.
- Review client: the first source-context load renders at once from the snapshot (as before). A failed load is retried once when the session reports `ready`, and the stale "source unverified" badge and blocked message are replaced in place. Companion calls made during startup wait for readiness and retry once. Iframe status messages dropped during resolution are re-requested. A "Starting preview server…" stage label.

Wrapper (uncommitted on `fix/live-preview-stability-v0.6.1`):

- New `preview-diagnostics.ts`: classifier (missing-dependency, missing-script, port-in-use, permission, compile-error, unexpected-exit, startup-timeout, companion-connection, unknown), sanitizer, Copy Diagnostics text. Added to the build's overlay list.
- `preview-services.ts`: classified failures for original and companion starts; a spawned companion that never becomes ready is stopped; a timed-out original start is a startup timeout, not a companion failure.
- `dashboard-controls.ts`: title, explanation, copyable recovery command, collapsible Technical details, Copy Diagnostics, Retry / Continue / Cancel; publishes `rtl-preview-state` and `window.rtlPreviewState`.
- `dashboard-session.ts`: `POST /preview/diagnostics` returns sanitized text for a classified failure only.
- `packages/rtl-analyzer/package.json` and the `implementation` submodule pointer: pin updated to `94a14e7`.

## Verification (executed in this workspace)

- `dashboard-readiness.test.ts` (implementation, jsdom, real client): 4 passed on the fix. Against the baseline client, 2 of 4 fail (the starting case and the Retry case); the static and no-session cases pass, as intended.
- Generated dashboard: every inline client script passes `node --check`.
- Sessions with a real `DashboardSession` (ephemeral port): Retry after a failed start moves the session to `ready`, the page re-requests the source context once (2 requests), and 10 findings render with no badge.

- Implementation `npm run rtl:scan:typecheck`: pass. `npm run rtl:scan:test`: **537 passed** (524 baseline + 6 runtime-process + 3 original-preview-runtime + 4 dashboard-readiness).
- Wrapper `npm run rtl:overlay:test`: **474 passed** (442 baseline + 23 diagnostics + 5 recovery dialog under jsdom + 3 session + 1 service timeout/connection).
- `npm run rtl:scan:build`: pass with pin `94a14e7`; `dist` contains `preview-diagnostics.js`.
- Generated dashboard inline client scripts pass `node --check`.
- `git diff --check` clean in both repositories.

## Not verified / blocked

- **Browser reproduction and Phase 7 acceptance are blocked.** Ports 4216, 4318 and 4320 are held by a live `npx rtl-analyzer` session (pid 55771 and children) started from `/Users/a.fouad/Projects/Testing-RTL/...`. It was not terminated. The fixed companion and dashboard ports cannot be moved.
- Real-browser reproduction and acceptance (Phase 7) not run.
- `rtl:cli:package:smoke` not run (it checks the same ports first).
- The iframe re-probe and the status-bar stage labels are code-level only.
- The findings list renders at once from the snapshot. The Before/After preview for a selected finding still waits for the preview server; the status bar shows the stage. Confirm the visible loading state in browser acceptance.
- Lifecycle repeated start/stop cycles and graceful-shutdown resource checks not added beyond the owned-child cleanup tests.
- Verified only the owned-child cleanup paths; no broad port-ownership test was added.
- Wrapper tracked duplicates of 20 implementation files differ from the pin (for example `dashboard-client.ts`, `review-session.ts`). The build does not read them, and the overlay tests run against them, so they can mask drift. Not changed here.
- No GitHub issue, milestone, PR, tag, release or npm publish has been made.


## Final release-candidate acceptance (implementation pin 0ef2f23)

Playwright Chromium against the packaged 0.6.1 tarball in a disposable consumer, using disposable Foundations Lab copies. Each run starts the CLI, opens the dashboard, enters Review one by one immediately, and records state transitions, console and network events, and screenshots. No run used a manual reload.

| Run | Before ready (s) | After ready (s) | Result |
|---|---|---|---|
| Normal, 3 runs | 4.5, 4.2, 5.3 | 5.8, 5.2, 7.1 | pass |
| Cold start, 12 s delay, 3 runs | 18.7, 17.5, 16.2 | 32.3, 31.1, 30.0 | pass |
| Dev server delayed 35 s | 39.3 | 75.8 | pass |
| Dev server delayed 45 s | 50.1 | 96.7 | pass |
| After delayed 20 s, 3 runs | 4.2, 4.3, 4.1 | 26.0, 25.5, 25.8 | pass |
| Before delayed 20 s | 27.3 | 28.5 | pass |
| After iframe HTML delayed 15 s | 4.3 | 50.8 | pass |
| Page opened after readiness | 4.8 | 5.3 | pass |
| Rapid navigation, 8 findings | 5.2 | 6.2 | pass |
| Genuine failure, Retry Preview | 5.5 | 6.7 | pass, retried |
| Startup timeout exceeded (15 s budget) | none | none | dialog: "did not respond in time … within 15 seconds" |
| Missing dependencies, install, Retry | 37.3 | 38.5 | pass, retried |
| Approve, Validate, Apply, Rollback | 5.4 | 6.6 | pass; SHA-256 `929268…` → `76a9c2…` → `929268…` |

Manual reloads required in every run: 0. Leftover listeners on 4216, 4318, 4320, 4202 after exit: 0 in all 22 final runs.
Automatic page loads during startup: 1 (the initial navigation). Apply and Rollback add the existing post-Apply reload.

Evidence: `acc/runs/*/timeline.json` and screenshots in the scratchpad (not committed).

# v0.6.2 performance, scalability and resource lifecycle — verification record

**2026-11-25. Local branches only; nothing pushed, merged, tagged or published. Round 3 results: see the section at the end.**

- Wrapper branch: `feat/v0.6.2-scanner-performance` (from `origin/main` `c875681`).
- Implementation branch: `feat/v0.6.2-scanner-performance` in `implementation/` (from pinned `b9f8ad2`); head `13bfe5a` at the end of round 2, which the wrapper pins (`packages/rtl-analyzer/package.json`; earlier head `3ac1864` in round 1).
- Issues: milestone `v0.6.2` (#4). New: #37 scanner scalability, #38 preview concurrency and lifetime, #39 durable rollback backups, #40 runtime reuse feasibility (Phase 4), #41 large-project dashboard stall. Moved and commented: #18 (workspace cleanup), #34 (readiness UX).

## Phase 1 — scanner scalability (verified)

Same machine, disposable copies of the Foundations Lab. v0.6.1 is the frozen build of `b9f8ad2`.

| Project | v0.6.1 scan | v0.6.2 cold | v0.6.2 warm | v0.6.2 incremental |
| --- | --- | --- | --- | --- |
| 3 files | 17 ms median (N=5) | 14 ms (N=5) | 3 ms (N=5) | — |
| 53 files | 4,332 ms median (N=3) | 186 ms (N=3) | 52 ms (N=5) | 180 ms (N=3) |
| 403 files | 293.9 s (N=1) | 1,438 ms (N=3) | 403 ms (N=3) | 1,330 ms (N=2) |

Causes (CPU profiles): project-wide scans inside the rule loop; a cross-file gutter lookup per fixed element; repeated property normalisation; a per-offset line split in `range()`; repeated per-binding reads in the candidate config writer.

Equivalence: outputs are byte-identical to the v0.6.1 build for the 3, 12, 53 and 403-file projects (cold and warm). The candidate config output is identical for the 53-file project.

Candidate config write (53 files): 505 ms → 371 ms cold; 174 ms → 102 ms warm.

Commit: `be0d32e`. Tests: `model-range.test.ts` (fuzz against the original definition), `scan-cache-performance.test.ts`.

## Phase 2 — preview concurrency and reliability (partly verified)

- Latest-selection-wins gate (`preview-supersession.ts`): a queued preparation is skipped with `PREVIEW_SUPERSEDED` when a newer one exists for the same workflow. Unit-tested. Started preparations are not interrupted.
- Locks: contextual-preview and history reads no longer take the workflow lock. The workflow snapshot stays queued. **A lock-free snapshot broke read-after-write** (the packaged smoke test returned the prior review id); this was found by bisecting the smoke test and is fixed in `3ac1864`.
- Lifetime: in-flight requests keep the companion alive; an open dashboard sends a heartbeat every 10 s (45 s grace). Standalone companion probe: responds in milliseconds on a 52-stylesheet project.
- Identity: the dashboard uses a preparation response only when `previewFocus` matches the requested finding; superseded responses are ignored without a recorded failure.

Browser, minimal benchmark (foundations lab, three runs each, same harness with dispatched rapid clicks, published-package consumers):

| Measure | v0.6.1 | v0.6.2 (`3ac1864`) |
| --- | --- | --- |
| Initial readiness, median | 1.81 s | 2.04 s |
| Cold navigation, median | 2.75 s | 2.67 s |
| Warm navigation, median / P95 | 2.34 s / 2.40 s | 2.10 s / 2.14 s |
| Preparation request, median / P95 | 1.10 s / 2.00 s | 1.02 s / 1.97 s |
| Runtime starts per run | 7 | 7 |

Interpretation: no measurable change on the minimal three-file path; the gains are in the scanner and in the lifecycle work, not in navigation latency. The target of warm navigation P95 ≤ 1.5 s is **not met** and needs Phase 4 (runtime reuse), which is not implemented.

Not verified:
- Eight rapid clicks reaching the companion: the UI disables Next during a preparation, so only two dispatched clicks reached the browser. The rule is covered by the gate's unit test only.
- A 52-stylesheet browser run reaching ready: not achieved. Issue #41 records the first finding without a preview route and a dashboard stall.
- Review GET P95 ≤ 150 ms during preparation under load: the 52-stylesheet run recorded companion requests ≤ 311 ms, but not a controlled measurement.

Commits: `f6a09ff`, `dc3d139` (heartbeat), `3ac1864` (snapshot ordering).

## Phase 3 — resource lifecycle and rollback durability (unit-verified)

- Ownership marker `.rtl-review-owner.json` written first in every new candidate workspace: schema, owner, pid, process start time (POSIX `ps`), creation time.
- Orphan sweep at companion start: removes only marked workspaces whose owner is gone or replaced (pid reuse detected by start time), that no persisted or live review references, and that are older than 10 minutes. Unmarked (legacy) workspaces are reported and never removed.
- Superseded candidates are disposed when a restart supersedes them. Applied candidates are disposed once Apply has recorded receipts (rollback uses receipts and backups only). Shutdown still disposes Reviewing candidates.
- Disposal outcomes are recorded on the workflow (`workspaceDisposal`); failed shutdown steps are logged.
- Rollback backups default to `~/.rtl-migration-analyzer/apply-backups` (0700; broader existing modes tightened). Receipts keep their recorded paths; a legacy-location receipt still rolls back.

Commit: `1a53ee5`. Tests: `review-lifecycle-durability.test.ts` (8).

Known gaps: no full workflow Apply-then-dispose test in the unit suite; the Playwright Apply/rollback regression suite was not run here; no migration of existing temporary backups (not done).

## Phase 5 — verification summary

| Check | Result |
| --- | --- |
| Implementation scanner suite (`vitest`, `tools/rtl-scanner`) | 566 passed, 0 failed (baseline 544; +22 new) |
| Implementation typecheck config | 6 errors, unchanged from baseline (postcss type definitions) |
| Wrapper overlay suite (`tools/rtl-scanner`) | 477 passed, 0 failed |
| Packaged consumer smoke (`npm run rtl:cli:package:smoke`) at `3ac1864` | passes (fails at `dc3d139` and `f6a09ff`; passes at `b9f8ad2` and `be0d32e`) |
| Scanner byte-equivalence vs v0.6.1 | identical for 3, 12, 53, 403 files |

Baseline note: the first baseline run showed two 5-second timeouts under load; on an idle machine the baseline suite (before changes) was not re-run separately, so the baseline count of 544 is from that run.

Not run here: cross-platform CI (macOS only); Windows checks; the Playwright `test:e2e:regression` suite; the 402-stylesheet browser run (single scan takes ~1.4 s, but the browser was not run at that size).

## Round 2 (Phase 4, dashboard, navigation, lifecycle) — status

Commits (implementation branch): `133a943` (typing fixes), `ad7d049` (runtime reuse), `9d731ad` (`RTL_PREVIEW_RUNTIME_REUSE=0` control), `13bfe5a` (owner watch). Earlier this round: `0cbcc80` (navigation during preparation, settled unmapped previews, bounded heartbeat), `9653fe4` (test temp isolation). Wrapper pins `13bfe5a`.

Verified in this round:
- Typecheck: **0 errors** (was 6). Exact cause: postcss 8.5.29 declares `AtRule_.type` as the base `string` rather than `'atrule'`, so `type === 'decl'` does not narrow the `ChildNode` union. Fixed with an explicit declaration type guard; the test error was an unchecked `PromiseSettledResult.value`. No check relaxed.
- Scanner suite: **571/571**. Overlay suite: **477/477**. Build: clean.
- Test isolation: each vitest run uses its own temporary root, removed afterwards; the user's temp directory is unchanged by a full run.
- Runtime reuse, browser (one minimal run on `ad7d049`): **one runtime start (npm + Vite) for seven navigations**, every navigation ready with verified targets, warm navigations 0.84–1.91 s (previous build: median 2.10 s). Manual-review findings settle as unavailable.
- Bridge equivalence: the page bridge built from the new state is byte-identical to the previous build's bridge for the same inputs (53-stylesheet fixture).

Not verified, and why:
- **Computed-style equivalence (reused versus fresh runtime):** the capture and the forced-restart control were prepared (`RTL_PREVIEW_RUNTIME_REUSE=0`, `CAPTURE=1`), but the process-running browser step was refused by the automated safety check in this session. Not claimed.
- **Owner watch (`13bfe5a`):** implemented; not exercised by a process test (refused).
- **Dashboard profiling (#41), eight rapid navigation actions with finding IDs, companion lifetime at 52 stylesheets:** not re-measured this round for the same reason.
- **Packaged smoke and Playwright regression suite on `13bfe5a`:** not re-run this round.
- **Apply, disposal, restart, rollback end to end:** the unit suite covers disposal, receipts and legacy rollback; a full workflow test needs valid validation evidence and is not yet written.
- **Cross-platform CI:** not run; requires remote CI.

Correction: the owner-watch code described in `0cbcc80` was not in that commit; it is in `13bfe5a`.

## Round 3 — final verification (head `bdeb955`, wrapper pin `bdeb955`)

Commits this round (implementation): `13a7dec` (one direction browser per process; verified direction gate memo), `bdeb955` (original and candidate direction pages captured concurrently); wrapper `91c3468` (probe budget; unsupported preview is not modal).

**Navigation performance, same harness and steps (next x6, prev; 5 runs each; warm = navigation with a ready After pane)**

| Build | Warm median | Warm P95 | Warm max | Runtime starts per run | Prepare request median / P95 |
| --- | --- | --- | --- | --- | --- |
| v0.6.1 (published) | 1.78 s | 2.40 s | 2.42 s | 6 | 1.10 s / 2.02 s |
| v0.6.2 restart control (`RTL_PREVIEW_RUNTIME_REUSE=0`) | 1.50 s | 1.90 s | 1.91 s | 11–12 | 1.12 s / 1.48 s |
| **v0.6.2 (`bdeb955`)** | **0.84 s** | **1.12 s** | **1.18 s** | **1** | **0.61 s / 1.02 s** |

Target warm navigation P95 ≤ 1.5 s: **met** (1.12 s, 20 warm navigations). Cold navigation median 2.74 s (v0.6.1) → 1.98 s. Initial readiness median 1.55 s → 1.05 s.

**Runtime reuse equivalence** (computed styles, 139 elements, 11 properties; RTL and LTR; candidate page)
- Reuse vs fresh-restart control at the same finding: **identical** in RTL and LTR.
- A → B → A (reuse) vs fresh runtime at A: **identical** in RTL.
- Sensitivity: in RTL the patch changes computed styles (candidate vs unpatched original: one element, `border-left-width` 4px → 0). In LTR the patch is invisible by design (physical-to-logical margin conversion keeps the computed left-to-right value), so RTL is the discriminating mode.
- JS/TS/JSX composition: **not verified** (the lab has no supported JS or TSX patch; `src/app.js` yields only a direction-unknown diagnostic).

**Rapid navigation** (eight dispatched clicks at 60 ms; finding IDs recorded after each click)
- All eight clicks dispatched; the selection changed on each click; navigation was not blocked by preparation.
- Final selection matched the candidate frame's finding ID in one run; the other final finding has no supported route and its pane reports unavailable with no candidate frame (no stale preview shown).
- Runtime starts: one per run (the composition changes did not restart the server).

**Dashboard (#41)**
- Root cause of the blocking state: a startup probe read only the first 25 findings; in a 52-stylesheet report the mapped findings come later, so the global state became `unsupported`, which opened a modal that intercepted clicks. Fixed: probe within a 20 s budget; unsupported is a status line, not a modal.
- 52-stylesheet run: readiness 1.05–4.3 s; each unsupported finding navigates in 0.1–0.2 s; no modal in any run after the fix.
- Heartbeats: bounded to one outstanding request with a 5 s timeout. In browser runs, 2–3 heartbeats per two-minute run were aborted (`ERR_ABORTED`) while the companion answered the same request in 6–113 ms when probed. **Root cause not identified**; accumulation is bounded.
- Not measured: main-thread profile and DOM size for medium and large reports (no profiling run completed this round).

**Process and resource lifecycle**
- Normal CLI stop: candidate present before stop (1), removed by the companion's shutdown (0), all ports free, isolated temporary root removed.
- Interrupted CLI (SIGKILL, harness-driven): companion exited in **1.6 s** (owner watch), candidate removed, all ports free.
- Orphan recovery: unit-tested (marker, owner liveness by start time, reference and grace checks, unmarked legacy never removed). Not exercised across a crashed companion in a process test.
- Temporary-directory isolation: vitest runs use a per-run root; the CLI in browser runs uses a per-run `TMPDIR` outside the project copy.

**Apply, dispose, restart, rollback — end to end** (`scratchpad/e2e/apply-rollback-e2e.mjs`, disposable lab copy, isolated HOME and TMPDIR)
1. Select and prepare `RTL.CSS.PHYSICAL:b8a43565…` (candidate runtime healthy).
2. Accept; validate → **Passed** (typecheck, build, test, scanner, runtime LTR, runtime RTL, runtime scoped direction).
3. Apply → state Applied; source SHA-256 changed (`76a9c244…`); candidate workspace **disposed** (`workspaceDisposal.state = disposed`, path absent).
4. Companion stopped and restarted; workflow persisted as **Applied**.
5. Rollback → state Rolled Back; restored SHA-256 `929268f3…` equals the original: **exact restoration**. Verdict **PASS**.

**Regression**

| Check | Result |
| --- | --- |
| Implementation scanner suite | 571 / 571 |
| Overlay suite (wrapper `tools/rtl-scanner`) | 477 / 477 |
| Typecheck (`tsconfig.typecheck.json`) | 0 errors (was 6; cause fixed, see `133a943`) |
| Package build | clean |
| Packaged consumer smoke (`npm run rtl:cli:package:smoke`) | passes at `bdeb955` |
| Playwright `apply-rollback-disposable` | 1 failed |
| Playwright `phase5-progress` | 2 failed |
| Playwright manual regression (security, restart, stale, failed lifecycle) | 7 failed, 13 passed |

The nine Playwright failures are **identical at v0.6.1** (`b9f8ad2`, checked out and run the same way): pre-existing in this environment, not introduced in this round. They must be explained before release.

**Not run:** the v0.6.1 recovery acceptance matrix (22-run harness); cross-platform CI; Windows.

## Remaining risks

- Warm navigation is still about 2.1 s on the minimal path (Phase 4 needed for the 1.5 s target).
- Cold scans of large projects are measured, not targeted.
- Heartbeat-based lifetime is new; the companion now stays alive while a dashboard page is open.
- Backups of existing temporary-directory receipts are not migrated.
- Candidate workspace for the Applied flow is removed; a historical "After" view of an applied review uses no candidate (code review, not browser-tested).

## Phase 4 — feasibility (for approval, not implemented)

See issue #40. Summary: a reuse path needs (1) composed-file updates reaching a healthy Vite server through its watcher with the same identity check, (2) computed-style equivalence against a fresh runtime, (3) an automatic restart fallback. None is implemented here.

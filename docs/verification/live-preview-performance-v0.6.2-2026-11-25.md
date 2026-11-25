# v0.6.2 performance, scalability and resource lifecycle — verification record

**2026-11-25. Local branches only; nothing pushed, merged, tagged or published.**

- Wrapper branch: `feat/v0.6.2-scanner-performance` (from `origin/main` `c875681`).
- Implementation branch: `feat/v0.6.2-scanner-performance` in `implementation/` (from pinned `b9f8ad2`); head `3ac1864`, which the wrapper pins (`packages/rtl-analyzer/package.json`).
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

## Remaining risks

- Warm navigation is still about 2.1 s on the minimal path (Phase 4 needed for the 1.5 s target).
- Cold scans of large projects are measured, not targeted.
- Heartbeat-based lifetime is new; the companion now stays alive while a dashboard page is open.
- Backups of existing temporary-directory receipts are not migrated.
- Candidate workspace for the Applied flow is removed; a historical "After" view of an applied review uses no candidate (code review, not browser-tested).

## Phase 4 — feasibility (for approval, not implemented)

See issue #40. Summary: a reuse path needs (1) composed-file updates reaching a healthy Vite server through its watcher with the same identity check, (2) computed-style equivalence against a fresh runtime, (3) an automatic restart fallback. None is implemented here.

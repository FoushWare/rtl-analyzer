# v0.6.2 release-candidate stabilization: lifecycle, audit and regression record

**2026-11-25. Local only. Not pushed, merged, tagged, versioned or published.** Implementation branch `feat/v0.6.2-scanner-performance`, pinned by `packages/rtl-analyzer/package.json` to `528578edff73f3750eb909388df49c142a62ef74`. Every count below was produced in the current workspace; the commands are named so they can be rerun.

**Recommendation: do not promote v0.6.2 to a release candidate yet.** The lifecycle, audit and workflow changes are verified and committed locally. Two blockers remain outside the code: an orphaned companion on port 4319 that makes the restart-reconnect test fail, and orphaned processes from earlier benchmark runs (listed under *Blockers*). Two release-pipeline items also fail before and after this work (see *Pre-existing failures*).

## Commits (implementation, local)

| Commit | Scope |
| --- | --- |
| `2de56a8` | `/review/apply` checks identity and the approved review before scanning |
| `da62774` | Bounded owned-process shutdown, owner-watch, manifest recovery (`owned-processes.ts`, `runtime-owner.ts`) |
| `30836d9` | Portable fixture preview configuration; workflow apply/rollback spec with exact SHA-256 restoration |
| `acf904e` | `ROLLBACK_FAILED` audit record for an authorized rollback refused by a source conflict |
| `a43fb1d` | Single-application trees (no `apps/` or `libs/`) can begin a review |
| `ef21801` | Security-negative suite disposes its companions and workspaces |
| `4eb1d99` | Workflow lifecycle E2E (`workflow-lifecycle.e2e.mjs`) |
| `2271a75` | Legacy-UI lifecycle scenarios migrated to the workflow specs |
| `4be9f86` | Legacy assertions superseded by workflow coverage removed |
| `0bfc657` | webServer companions stopped gracefully so teardown disposes candidate workspaces |
| `d0e04e5` | Typing fix in `contextual-review-preview.spec.ts` (root typecheck) |
| `04742b0` | Empty manifest directory removed at companion shutdown |
| `880632a` | Packaged smoke removes its temporary workspace and dashboard folders |
| `528578e` | Restart reconnect test uses the owned-companion helper and disposes its workspace |

Wrapper: pin updated to `528578e`; `scripts/consumer-smoke.mjs` removes the packed tarball whether packing or the smoke fails.

## Audit contract: `ROLLBACK_FAILED`

Approved 2026-11-25. Implemented in `ControlledApplyService.rollbackAcceptedFiles` (`controlled-apply.ts`):

- A rollback whose receipt the audit journal trusts, and whose source matches neither its applied nor its original bytes, appends `ROLLBACK_FAILED` with `reason: CURRENT_SOURCE_CHANGED`, the original and current SHA-256 values only, then refuses with `ROLLBACK_CONFLICT`.
- Nothing is written. The applied workflow state, the receipts and the durable backups are unchanged.
- An untrusted receipt (`ROLLBACK_RECEIPT_UNTRUSTED`) and an unauthorized request (missing `ROLLBACK_CONFIRMED`) create no audit record.
- Regression: `review-workflow.test.ts` (conflict: one record per refused attempt, no source content in the journal; untrusted receipt: no record) and `workflow-lifecycle.e2e.mjs` (conflict via HTTP, unauthorized request, persisted `Applied` state).

## Test matrix (final)

| Suite | Command | Result |
| --- | --- | --- |
| Scanner unit | `npx vitest run --config tools/rtl-scanner/vitest.config.ts` | 57 files, **579/579 passed** |
| Root unit | `npx vitest run` | 2 files, **9/9 passed** |
| Owned-process unit | included above (`owned-processes.test.ts`) | **7/7 passed** |
| Scanner typecheck | `npm run rtl:scan:typecheck` | pass |
| Implementation typecheck | `npx tsc --noEmit` (implementation) | pass |
| Scanner build | `npx tsc -p tools/rtl-scanner/tsconfig.json` | pass |
| Implementation build | `npm run build` (implementation, Nx) | pass |
| Workflow lifecycle, Node | `node --test tests/e2e/workflow-lifecycle.e2e.mjs` | **3/3 passed** (validated apply, restart, rollback exact; refused conflict with audit; stale apply refused) |
| Workflow lifecycle, Playwright | `npm run test:e2e:workflow-lifecycle` | **3/3 passed** (approved-stale, failed-lifecycle, stale-lifecycle; one invocation each) |
| Apply and rollback | `playwright.apply-rollback.config.ts` | **1/1 passed** (SHA-256: original → applied → original) |
| Phase 5 progress | `playwright.phase5.config.ts` | **2/2 passed** |
| Security negative | `playwright.manual-regression.config.ts` (security-negative) | **15/15 passed** |
| Restart reconnect | `playwright.restart.config.ts` | **0/1, blocked** (orphan on port 4319; see *Blockers*) |
| Packaged consumer smoke | `npm run rtl:cli:package:smoke` (wrapper) | **pass** (`CONSUMER_PASSED`, exit 0) |

Playwright totals for the intended specs: 21 passed, 1 blocked, 22 total. Unit totals: 588 passed (579 + 9). Each Playwright, Node and smoke run was executed with `TMPDIR` set to a run-specific directory. After each run, the directory contained no workspace and no owned process. The one exception is Node's own `node-compile-cache` directory, which is not written by this code.

## Process lifecycle

Shutdown is bounded and ordered: stop accepting and close sockets; stop every owned process group (SIGTERM, then SIGKILL after 1.5 s); persist workflow state; dispose session workspaces; exit. A hard deadline of 8 s SIGKILLs the owned groups before exiting.

Scenarios (isolated temporary roots; before → after the change):

| Scenario | Before | After |
| --- | --- | --- |
| SIGTERM, idle | 9–25 ms | ~11 ms, no leftovers |
| SIGTERM during candidate preparation | — | 73 ms, no leftovers |
| SIGTERM with an open browser connection | 25 ms | 22 ms |
| SIGTERM with a partial request in progress | 3.0 s, exit 1 | 25 ms, exit 0 |
| SIGTERM during validation | 3.1 s, exit 1 | 82 ms, exit 0, no leftovers |
| SIGKILL with a candidate runtime running | candidate orphaned | candidate exits by owner-watch; none left after 3 s |
| Owner CLI killed (`RTL_PREVIEW_OWNER_PID`) | not handled | companion exits within about 2.5 s |
| Successor companion after SIGKILL | — | manifest recovery covered by unit tests (identity-checked) |

Not reproduced: the companion that ignored SIGTERM for 24 minutes (PID 74803, earlier). The shutdown code above removes the paths identified by inspection, but the root cause of that earlier hang is not proven.

## Heartbeat

Measured with an open dashboard, a companion with idle-exit enabled (15 s idle grace, 45 s heartbeat grace):

- Beats every 10 s; 4 succeeded in the first 40 s.
- Companion frozen with SIGSTOP for 20 s: 7 beats failed or aborted on the client; no page errors.
- After resuming: beats resumed and the companion stayed alive.
- After the browser closed, the companion exited about 76 s later (45 s grace, idle check, poll).

Conclusion: aborted heartbeats are advisory. They affect the companion only through the 45 s grace, and the page recovers on its next beat.

## Dashboard mapped and unmapped verification

Synthetic single-application projects (60 files / 480 findings; 250 files / 2,000 findings), live companion, dashboard on the allowed origin:

- Mapped finding (`Row0`): "Configured source binding · runtime verification required". The original runtime was unavailable because the synthetic project has no dev server (expected).
- Unmapped finding (`Row1`): "No configured source binding"; "This finding has no configured page/element mapping."
- Static dashboard (no companion), selection latency median: 5 ms (480 findings) and 28 ms (2,000 findings), for both classes.
- Cold load to interactive: about 300–400 ms for both sizes.
- Long tasks at load: one, 110–145 ms.

## Runtime reuse equivalence (TSX and JSX)

Same navigation with reuse on and with the fresh-runtime control (`RTL_PREVIEW_RUNTIME_REUSE=0`). Two findings prepared in sequence; each rendered in LTR and RTL on the candidate runtime.

- TSX (portable `InvoiceTable.tsx`): DOM equal between reuse and fresh for both steps; direction `ltr`/`rtl` correct; 8 `<bdi>` isolations; 6 invoice links.
- JSX (same component transpiled to `.jsx`, with relative imports because `vite-tsconfig-paths` resolves aliases for `.ts`/`.tsx` only): DOM equal between reuse and fresh; same counts and directions. The application cannot resolve `@atlas/*` in `.jsx` files; this is a limitation of the fixture's Vite configuration.
- Runtime port stable across navigation in both modes (4202).
- Not re-measured here: runtime process identity across navigation (benchmark evidence from earlier work), baseline restoration across many compositions, and restart fallback. Those rest on the earlier benchmark and the unit tests in `runtime-reuse.test.ts`.

## Workflow contract notes (for review)

- After a source edit, a validated change keeps `validation: Passed`. The authoritative Apply refuses it with `STALE_ORIGINAL_SOURCE`; the dashboard shows the review as blocked on reload. The legacy `Stale` lifecycle projection is not shown in the workflow UI.
- The workflow rollback refusal is not a UI control in this probe: the rollback action lives in the Review actions menu and was not reliably reachable after an edit, so the refused rollback is verified through the workflow API.

## Pre-existing failures (not introduced here)

- Wrapper root `npm run typecheck`: five TS7016 errors from the tracked wrapper copies of `playwright.*.config.ts` and `tests/e2e/*` (initial source release); no declaration files for `.mjs` imports. Implementation typecheck passes.
- Wrapper root `npm run build` (Nx): project graph conflict (`libs/shared` defined in two locations). Implementation build passes.

## Blockers

1. **Orphaned companion on port 4319** (PID 74803, started by an earlier run). It answers health checks, so the restart reconnect test cannot pass. Stop it.
2. **Orphaned processes from earlier benchmark runs**: companion on 4399 (PID 94652) with its candidate runtime on 4212 (PID 94685); two static servers on 4511 (PID 80929) and 4512 (PID 80959). These are not owned by any running test. Stop them.

```bash
kill -TERM 74803 94652 94685 80929 80959
```

Escalate with `kill -KILL` only if any remains after a few seconds.

## Not done

- Restart reconnect test (blocked by blocker 1).
- Promotion of the reuse-equivalence script into the repository (executed; not committed, since it uses absolute paths).
- Wrapper release steps: publication, tagging and version bump are not part of this record.

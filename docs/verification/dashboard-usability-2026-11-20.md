# Dashboard usability verification

Verified 2026-11-20. This continues the approved dashboard usability task. Human acceptance remains pending Ahmed's manual review. No push, publication, tag, deployment or worktree cleanup was performed.

## Final source and package

- Starting implementation: `7ae085026d4ef502d54e6213b22c0342f89dbcfe`; starting wrapper: `ce0512c9d79222a0aa81eedc2d5fd410f3a9a7b8`.
- Final implementation: `8e8b85409def28c2bd1e303b3ac882d0fda0751d`.
- Wrapper package/pin commit: `5e59c642f34cf23f8c614ff5896b88653015f957`. Subsequent documentation commits do not change package inputs.
- Package: `rtl-analyzer@0.3.0`, built by `npm pack` in `packages/rtl-analyzer`, including its normal `prepack -> npm run build` process. Build guards remained active.
- Final tarball: `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-GbyO6G/rtl-analyzer-0.3.0.tgz`.
- SHA-256: `0dee9a521c62269cc095a5711b705e25c995f392719b82b6a82f511382305c87`.
- All 68 installed package files were compared byte for byte with their tarball members. Installed metadata pins the final implementation above. Generated dist files were not edited.

## Diagnosis and scoped corrections

The earlier browser route matched only `http://127.0.0.1:4320/rtl-report-dashboard.html`. Navigation added `?finding=...`, which failed that exact match and reached the old Python server. Its command line served `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-package-consumer-aLBRNx/reports`; its HTML contained the stale `9e97b53b...` digest observed in the failed source-context request. A fresh HTTP fetch reproduced that digest. This explains the failure without assuming cache corruption or report regeneration. The new run uses the actual static server and package's supported dashboard/companion origins, with no HTML or transport alias. Network HTML is compared to the exact on-disk artifact before interaction, and reload is checked again.

The old listeners were verified as prior task-owned disposable smoke services before termination (companion 99096, dashboard 99097, original runtime 99130). The unrelated companion PID 20313 on port 4321 was preserved.

Fresh browser verification exposed three product issues, fixed locally:

1. Approval was wrapped in the shared busy operation twice; the inner call returned without submitting a write. The approval handler now owns one save operation and opens confirmation only from its persisted Accepted response.
2. Confirmation/navigation tried to focus a hidden legacy heading. The visible selected-source heading is now programmatically focusable and receives Escape, Stay, Next and unresolved-return focus.
3. Asynchronous preview replacement temporarily shortened the document, clamping page scroll (150 -> 38) before the preview returned. Selection now reserves the previous comparison area's height while rebuilding. The reservation resets on viewport resize. Source text, ranges, horizontal reveal, line numbers and preview zoom are unchanged.

The existing informational presentation filter remains in place: information is retained in analysis/export data and excluded from the review collection. The existing dashboard layout and separate original/proposed code cards are preserved.

## Executed results

All final browser runs used the installed final tarball and the same standard disposable Field Notes fixture. Fixture source and transformation support were not changed to obtain a pass.

| Check | Actual result |
| --- | --- |
| `npx playwright test --config=playwright.manual-preview.config.ts tests/e2e/dashboard-usability.spec.ts tests/e2e/independent-onboarding.spec.ts --output=test-results/usability-recovery/final-package-browser` with `RTL_MANUAL_ENVIRONMENT` set to the run below | **3 passed, 50.0s** |
| Approval ordering/failure/duplicates | Real write persisted while response held; no early dialog. Synthetic 503 displayed `Blocked: TEST_APPROVAL_FAILURE`, left Pending, no success. Disabled duplicate click sent no second request. Accepted repeat disabled. Original source unchanged. |
| Confirmation/navigation/accessibility | Exact title/description, no automatic advance; initial primary focus, Tab/Shift+Tab containment, Escape/Stay restoration, dialog Next and persistent Decision-side navigation passed. Existing top navigation remains. |
| Summary | Last visible finding: 3 accepted/3 unresolved, scope 6; unresolved return passed. Filtered scope 1: 1 accepted/0 unresolved. Last supported approval offered Review summary. |
| Notes/decisions | Saved note and unsaved draft survived navigation; cancel restored the saved note. Accepted decisions survived selection and reload. |
| Mixed informational data | Workspace: 8 reviewable records; selected CSS file: 6. Two informational records excluded from review IDs, direct links/reload, list and review counters; original JSON export retained both. No informational statistics card. |
| Information-only browser case | **Passed.** Installed renderer presented the informational subset of this same scan offline: exact `No reviewable findings.`, no finding/file buttons, zero review count, both analysis records retained, direct link/reload checked. This is a presentation case with source context deliberately unavailable, not a separate application scan or a successful online review. |
| Source reveal | **Passed** at widths 1600 and 560, computed source text 12px and 22px, nonzero page scroll (190 and 905), finding changes and panel toggles. Exact token and line number within source container and viewport, below toolbar; page scroll stable within 1 CSS pixel of browser layout rounding. |
| One-by-one full journey | **Passed.** Real original/candidate identity, mapped/unmapped states, LTR/RTL computed styles, 3 accepted repairs, rejection/pending preservation, configured typecheck/build/test/scanner/runtime validation, accepted-only Apply, intervening-edit rollback refusal, exact source restoration and fresh pending review. |
| Prepare-all full journey | **Passed** with the same assertions, including validation freshness and fresh review after rollback. |
| `node tests/e2e/physical-direction-context.mjs` | **Passed** all 4 page-direction/declaration combinations with local LTR and RTL overrides. |
| Scanner typecheck + 9 existing test files | **Passed, 102 tests.** Dashboard, workflows, scoped direction evidence, controlled Apply, target identity, contextual preview, runtime direction, rollback recovery and workflow validation. |
| Final usability browser console/network | **0 page errors; 0 failed requests.** Earlier rapid-navigation runs included canceled preview-frame asset requests (`ERR_ABORTED`); the test records them separately and permits only canceled subframe requests, never dashboard/companion failures. |

Existing test assertions were updated for the current physical-property approval label and automatic preview behavior. Unmapped preview errors remain required. Code approval eligibility differs by mode when prepare-all has already prepared an unmapped patch; validation/Apply protections are unchanged.

The optional two-person UI fixture produced `DIRECTION_EVIDENCE_AMBIGUOUS_TARGETS` because repeated targets lack stable keys. Its validation block was retained as negative evidence; no identity or approval safeguard was weakened. Positive Apply/rollback uses the existing default one-person fixture configuration. No general claim is made that ambiguous targets can pass validation.

## Evidence and screenshots

Run root: `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-GbyO6G`.

The `evidence` directory holds copied final traces, videos, screenshots, test/workflow JSON, package provenance and manual URL identity checks. The repository copy is under `implementation/test-results/usability-recovery/final-package-browser`.

Screenshots in `evidence/browser/dashboard-usability-persis-6048b-clusion-and-readable-source/`:

- `approval-confirmation.png`
- `last-approval-confirmation.png`
- `last-finding-summary.png`
- `dashboard-no-informational.png`
- `source-1600-false.png`, `source-1600-true.png`
- `source-560-false.png`, `source-560-true.png`

`evidence/information-only.png` shows the empty presentation case. Both workflow directories contain acceptance JSON, expanded LTR/RTL screenshots and restored source identity evidence. `provenance.json` lists all installed file hashes. `manual-urls.json` records matching report, original and candidate identities.

## Running manual walkthrough

Verified after all regressions, with source restored and one-by-one review Pending:

1. Open <http://127.0.0.1:4320/rtl-report-dashboard.html?finding=RTL.CSS.PHYSICAL%3Ae382b9aea738a8b457207d30> and choose **Start manual review**. The current scan digest is `53973df90890418c887047bfad2cf536eb4f3721e723e75b11bc7fc786cd75cd`.
2. Inspect source and separate proposed code; compare verified Before/After previews. Approve, then try Stay, Escape and Next. Approval changes the decision only.
3. Use the persistent Next beside Decision. At the last visible finding, open Review summary and return to unresolved findings. Use search to inspect filtered summary scope.
4. Resize or toggle panels, and inspect the exact highlighted source range and line number. The JSON report link retains informational records.
5. Validation and Apply are separate actions. Both modes were exercised by the browser regressions; Ahmed's human acceptance remains pending.

Other verified URLs:

- Companion health: <http://127.0.0.1:4318/health>
- Original: <http://127.0.0.1:4215/people?direction=ltr>
- Current one-by-one candidate: <http://127.0.0.1:4203/people?direction=ltr> (workflow-owned; may change after starting another review)

Ownership: supervisor **57672**, companion **57687**, dashboard **57692**. Original/candidate runtimes are children owned by the companion. `environment.json` is the authoritative current process record.

To check ownership without stopping anything:

```sh
node /private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-GbyO6G/stop.cjs --check
```

To stop only this run:

```sh
node /private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-GbyO6G/stop.cjs
```

The stop script verifies supervisor command, child parentage and each child's consumer/report path before sending SIGTERM to the supervisor, which stops its recorded services and owned previews. It refuses changed ownership. It does not delete the run, source, history, backups or evidence.

## Remaining limits

Human acceptance remains pending. The archived workspace memory validator still reports 47 missing required links, 6 optional missing links, 50 potentially stale sources and one undated entry; these concern preserved historical/archive material and were not rewritten. The current wrapper has no memory validation script. This verification does not certify those historical assets or change prior release approval states.

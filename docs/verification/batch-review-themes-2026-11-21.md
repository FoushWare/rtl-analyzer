# Batch review, operation loaders and color themes

Verified 2026-11-21. CONTINUE: approved local dashboard acceptance delivery. Human acceptance remains pending. The attached Batch Review image defined the hierarchy; the user confirmed the written requirements alone define the theme picker and reproduction steps.

## Causes and implementation

- Automatic mode already composed code-supported patches at begin, but entered the selected finding detail and relied on per-finding preview preparation. It now explicitly verifies configured original/candidate targets across the selected review scope before opening Batch review. The server records per-entry readiness or an actual blocker. Group verification reuses one browser; failed groups isolate individual target failures without removing a patch until remaining target proofs finish, preventing stale-composition cascades.
- The overview uses persisted workflow entries, shows prepared/pending/manual/approved counts, all reachable rows, explicit all-scope selection semantics and zero-selection start. Checkbox selection does not approve anything. The server checks the whole selected set before atomic acceptance; forged, duplicate, blocked or non-pending selections are refused. View diff uses the existing detail. Back restores page/list position and selection, synchronously and again after layout. Individual approval remains available.
- Validate strips unapproved candidate patches under existing rules, and Apply remains explicit and accepted-only. The overview distinguishes the prepared inventory from the exact currently validated approved subset. Deferred and Needs review remain unresolved and excluded from Apply; their manual-review state is visible.
- Preparation, validation and Apply use a real-state modal with an indeterminate spinner, readable count/text and backdrop. Reduced motion stops spinner rotation without hiding it. Existing success/failure/Uncertain reconciliation and operation IDs are preserved. Source-write confirmation, freshness, source/config/runtime identity, direction proof, receipts and protected rollback are unchanged.
- Session details now lives immediately after Files and Findings in the wrapping Workspace panels row. It opens the same details panel, including applied history after rescan/reload and narrow layout. Existing shortcuts use that button.
- Shared semantic color tokens cover legacy generated colors and dynamic panels, source highlights/diffs, status, dialogs and spinners. Studio Dark preserves the default colors; Dracula, Nord, Solarized Light and GitHub Light provide alternatives. Palette trigger sits beside Search findings. The menu provides representative swatches, saved radio state/checkmark, hover/arrow preview, click/Enter commit, persistence, Escape/dismissal cancellation, focus return and outside-click focus preservation. Late legacy important panel colors are overridden by authoritative semantic tokens, without transient panel-color interpolation. Decorative swatches/checkmarks are hidden from assistive technology; saved state is announced through aria-checked. Embedded project documents are not restyled.

Browser-led corrections: decorative checkmarks initially changed theme accessible names; a sticky footer obscured the manual-review explanation; list restoration happened one frame late; finding selection could shift page position two pixels; busy context events could be dropped without a retry; explicit Resume of a fresh post-rollback batch did not prepare its candidate. These were fixed without relaxing browser assertions or protected operation rules. Rollback API still creates an analysis-only fresh review; preparation occurs only after explicit bulk Resume.

## Padding walkthrough

`.unmapped { padding-left:6px }` is a real rendered element deliberately absent from the fixture mapping. It stays as independent negative regression coverage, with an honest missing-binding reason and code-review / Defer / Needs review route. It is excluded from batch selection and source Apply.

The existing equivalent mapped padding example is `.reject-me { padding-right:11px }` in `src/reading.css`, accurately bound to `.reject-me` on `/people` in the independent Field Notes fixture. Its original physical right padding and proposed inline-end padding are checked on the real original/candidate target under both LTR and RTL. No CSS defect or mapping was fabricated or removed to make a test pass. The tests modify only the explicitly approved subset during Apply, then hash-exact protected rollback restores the disposable source.

## Verification and package

Final execution results, provenance and live URLs are recorded below from the installed-package acceptance run. Earlier diagnostic traces and unsuccessful attempts are retained separately; they are not counted as passes. Initial highly parallel scanner runs and a later overlapping run hit existing five-second test limits under host pressure. Sequential scanner runs keep the original timeouts. A final recovery test initially asserted the uncertain-result dialog at five seconds while validation was still running (the recorded request took just over five seconds). The regression now waits for the injected disconnect before checking reconciliation; no product delay, timeout guard or success rule was changed. Both recovery modes passed on rerun. Browser video was disabled in the final run to reduce contention; trace collection, screenshots and assertions remain enabled.

An early local pack command was mistakenly invoked at the implementation root. Its `atlas-invoice` archive was never installed or used as the deliverable. The final artifact is built only from wrapper `packages/rtl-analyzer` through normal committed prepack/build, and archive contents are checked independently. No generated dist overlays or unpublished source enter it.

## Preservation and limits

One isolated copy of the same Field Notes walkthrough fixture is used throughout this delivery. Earlier reports, states, candidates and receipts are preserved; new package/report/state directories are created rather than overwriting them. Only ownership-verified task supervisors were stopped to recover supported ports. No user-owned service, original consumer project, application CSS in the authoritative implementation, or unrelated archive edit was modified. The obsolete checkout was not used.

Zero-prepared browser coverage temporarily removes preview bindings only in this disposable fixture, generates a fresh matching report with the final installed CLI, and restores the config byte-for-byte in finally; it does not bypass identity checks. The initial attempt correctly received an identity rejection because it reused the prior configuration’s report; that was a test-environment mismatch, not a product guard defect. New review creation uses the resulting current configuration. Required direction-dependent evidence remains mandatory. Server restart during a mutation stays Uncertain and blocked pending inspection; no success/non-execution is inferred from a lost request. Drafts remain tab session storage; saved notes remain persisted server records. No real assistive-technology audit or broader platform/full-application-suite certification is claimed.

Local commits only. No push, publish, tag, deployment or worktree cleaning. Ahmed human acceptance remains pending.

## Final package provenance

- Implementation: `ad5ccfb3a546b5d9e56ea43895ef047ebd0507c5`.
- Packaging wrapper/pin: `637dd6130ea24dabe6dad1db972bd01848a2e2cf`; later documentation commits do not change package bytes.
- Final tarball: `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/package-10/rtl-analyzer-0.3.0.tgz`.
- SHA-256: `b891b4ccefa2f816fa7014c7029b96fcf7e69eed800ddda04b1b30ba5ca36778`.
- **72 installed files match the archive byte-for-byte**; explicit allowlist admits only dist JavaScript, package metadata, README and LICENSE. No tests, examples, project files, development assets or accidental root archive are included.
- Report generated with the installed consumer CLI in `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/report-10`; input digest `3e300953f9d7d695dea1770ee57c4479efa034510939dcd59067e81a720c23b4`, policy `a2c934271770b291644126389d76cd092df1c84240860214dbd265e75644ad27`.
- Final scanner typecheck and full scanner tests: **37 files / 414 tests passed** (`scanner-10.log`). No full application suite or lint pass is claimed. Fresh-entry browser test: **1/1 passed** (`entry-10.log`) against that installed tarball. The remaining final browser group passed **9/9**, giving **10/10 installed-package browser tests** across seven spec files.

## Exact final checks

| Check | Actual result |
| --- | --- |
| Scanner typecheck, `npm run rtl:scan:typecheck` | Pass, final implementation |
| Full scanner suite, `npm run rtl:scan:test -- --maxWorkers=1` | 37 files, 414 tests passed; `scanner-10.log` |
| Fresh entry / both modes / Resume-New / stale preference / notes, drafts and cross-file state | 1/1 passed; `entry-10.log` |
| Batch, themes/zero-prepared, cross-file, usability, both guided-operation modes, both independent-onboarding modes, preview-status | 9/9 passed; `browser-10.log`, Chromium, one worker, 3.0 minutes |
| Direction physical/logical regression | Four browser scenarios passed: LTR/RTL page direction with local LTR/RTL override; physical right stays right, logical inline-end switches correctly; `direction.log` |
| Mapped padding | Real `.reject-me` target: right 11px original; inline-end 11px candidate; verified LTR and RTL; accepted subset validated, explicitly applied and exact rollback |
| Batch-only acceptance | Seven prepared across JSX/CSS, one manual item, zero initial selection; selecting only padding and JSX name persists exactly two approvals; validation changes neither original file; Apply changes exactly those declarations; two-file protected rollback restores both hashes |
| Busy and recovery | Held real requests expose spinners for prep/Validate/Apply, dark and light operations; reduced-motion static spinner; duplicate/conflicting mutation prevention; real stale-candidate failure, lost validation/Apply response reconciliation, no duplicate mutation, reload recovery, source destination Cancel/no write |
| Review preservation | Persisted approval before success; Next/Stay/Escape/focus, persistent navigation, project-wide summary/filter continuation, Deferred/Needs review unresolved, decision/notes reload, informational exclusion with retained report records, sticky/source highlighting across narrow/enlarged/scrolled/toggled layouts |
| Post-Apply | Historical/current state separation, remaining-review entry, reliable unchanged Deferred decision/note carry, deliberate unmapped approval disabled; stale rollback refusal followed by receipt-backed exact rollback in both modes |
| Themes | All five preview/cancel/keyboard/persist; 560px width has no page overflow; sampled main text and panel/navigation controls exceed 4.5:1 in every theme; focus assertions; dashboard theme does not alter original or candidate document body color |
| Manual environment | Actual browser HTML matches served disk bytes; embedded digest and successful source-context requests match report; companion root/application and original/candidate identities/source hashes verified; zero page/console/HTTP/request errors in fresh unforced walkthrough |
| Package | 72 installed files hash-match archive; committed implementation metadata matches package pin; only distribution JavaScript/metadata/README/LICENSE |

Final browser commands used `RTL_MANUAL_ENVIRONMENT=<run>/environment.json npx playwright test --config=test-results/batch-acceptance/playwright.config.ts`, first `tests/e2e/review-mode-entry.spec.ts --output=test-results/batch-acceptance/entry-10`, then the six remaining spec files listed above with `--output=test-results/batch-acceptance/browser-10`. The config inherits supported manual-preview configuration and disables video only; traces and screenshots remain enabled. Package build: `npm pack --pack-destination <run>/package-10` **from wrapper `packages/rtl-analyzer`**, normal prepack. Consumer: `npm install --no-audit --no-fund <tarball>`. Report: installed consumer `rtl-analyzer scan --root <run>/field-notes --format dashboard --embed-source-snippets --output-dir <run>/report-10`.

Earlier failed attempts are diagnostics, not passing checks. Their logs remain in evidence; full older traces remain in implementation `test-results/batch-acceptance`. Final scanner and browser logs above are authoritative for counts. No broader full application suite, lint, Safari or assistive-technology certification is claimed.

Archive project-memory validator ran after verification: 163 links checked, 47 missing required, six missing optional, 50 potentially stale sources, one undated entry. These are existing archive-wide warnings, reviewed and retained; no unrelated historical records were rewritten. Archive working changes/untracked assets remain unchanged. Preserved earlier user Applied CSS hash `d800d91daad82750c5b767f7ec0b5e9ec170bdc6b3aa2e5bfaf3b327c70383e9`; previous guided fixture and current rolled-back fixture CSS hash `53f90e7a6f0f0c2e2c5f019514ca253f95a4548ae324f5c0024cc4d22ba40137`.

## Walkthrough and screenshots

- [dashboard](http://127.0.0.1:4320/rtl-report-dashboard.html?run=batch-10).
- [mappedFinding](http://127.0.0.1:4320/rtl-report-dashboard.html?run=batch-10&finding=RTL.CSS.PHYSICAL%3Afe9138c0e7b44428891c7a01).
- [companion](http://127.0.0.1:4318/health).
- [original](http://127.0.0.1:4215/people?direction=ltr).
- [candidate](http://127.0.0.1:4208/people?direction=ltr).

The fresh bulk workflow is `1eaa13ee-4e73-45a7-8de3-de29f3fab72e`: seven prepared/Pending, zero approved, one blocked. Fresh top-level entry deliberately presents Resume/New; choose **Resume existing review** for this prepared batch or create a new review explicitly. From the padding link, choose Resume then View diff for **Review physical padding**, `src/reading.css`, `.reject-me`, finding `RTL.CSS.PHYSICAL:fe9138c0e7b44428891c7a01`. The candidate contains the prepared inventory; it is not applied source. The blocked `.unmapped` finding `RTL.CSS.PHYSICAL:3addbb7badd35fc9ef4d7a56` has no configured page/element binding and no verified directional evidence; review code/Defer/Needs review remains available.

Evidence directory: `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence`. Fresh screenshots:

- [Batch landing](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/manual-batch-ready.png).
- [Open theme menu](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/manual-theme-menu.png).
- [Mapped padding in GitHub Light](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/manual-padding-light.png).
- [Entry chooser](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/guided-operation-flow-one--faa78-maining-review-and-rollback/entry-chooser.png).
- [Preparation spinner](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/batch-theme-review-batch-p-94ade--history-and-exact-rollback/preparing.png).
- [Validation spinner](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/guided-operation-flow-one--faa78-maining-review-and-rollback/validating-overlay.png).
- [Validation result](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/guided-operation-flow-one--faa78-maining-review-and-rollback/validation-result.png).
- [Apply confirmation](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/guided-operation-flow-one--faa78-maining-review-and-rollback/apply-confirmation.png).
- [Apply result](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/guided-operation-flow-one--faa78-maining-review-and-rollback/apply-result.png).
- [Remaining review](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/guided-operation-flow-one--faa78-maining-review-and-rollback/remaining-review.png).
- [Approval dialog](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/dashboard-usability-persis-6048b-clusion-and-readable-source/approval-confirmation.png).
- [Project-wide summary](/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/evidence/browser-10/cross-file-review-project--c3a7d-es-and-unresolved-decisions/project-wide-summary.png).

Services remain running: supervisor **50348**, companion/dashboard children **50359, 50364**. The ownership verifier checks exact commands and parent relationships, then asks the supervisor to stop its recorded children and owned preview runtimes. Do not kill arbitrary port owners.

```sh
node /private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/stop.cjs --check
node /private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-independent-onboarding-batch-rl7kl830/stop.cjs
```

Human acceptance remains pending. No push, publish, tag, deployment or source edits to real consumer projects occurred.

## Visual polish continuation

The shared theme layer was refined after comparing the attached Safari captures: page and panel surfaces now have clearer separation, active navigation uses restrained raised-surface color with a narrow accent edge, the logo glow is reduced, focus remains a distinct keyboard ring, and hover/selected/disabled rows use the same semantic tokens. Batch review now uses a tighter header and statistics rhythm, lighter row dividers, a denser table, readable status hierarchy and a sticky action footer that stays visible without obscuring the table’s final row. Finding detail, code diff, Session details, dialogs, loaders and the theme menu inherit the same token hierarchy; embedded application previews remain untouched.

These changes are implementation `c904da2e089a1418e24e41e744ba2cf50a5ae7d8`, wrapper pin `ba985ae`, and package-11 tarball SHA-256 `f61beb15e0eebe59529001ec99d15eca42467d7707f4885ecc4f09cea5fcee8d`. The supported `packages/rtl-analyzer` prepack produced 72 files. Package-11 browser verification: the two batch/theme scenarios passed (28.2 seconds) with screenshots `browser-11/.../theme-{studio,dracula,nord,solarized,github}.png`, `batch-review.png`, `mapped-padding-{LTR,RTL}.png`, and `zero-prepared.png`; the existing 10-test acceptance remains green on the prior package baseline. Scanner typecheck and 414-test suite remain green after the polish. A WebKit launch was attempted using the installed Playwright runtime, but the WebKit executable is not installed (`webkit-2370/pw_run.sh` missing); no Safari/WebKit pass is claimed.

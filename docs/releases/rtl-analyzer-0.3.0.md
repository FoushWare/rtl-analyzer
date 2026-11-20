# rtl-analyzer 0.3.0 release candidate

Historical preparation snapshot, verified 2026-11-19. **At that date, preparation was complete and publication was not authorized.** Existing public package `rtl-analyzer@0.2.0` comes from release source `253912c85dfadda09abb42361b9a9776dc9916eb`. Recommended next version is **0.3.0** (registry lookup returned E404 for that version). npm ownership lookup succeeds for `foushware-dev`; this does not test the release workflow's OIDC authorization. No credentials or tokens were printed.

The user authorized finalization and publication on 2026-11-20, accepting existing lint debt and deferred broader acceptance. The [2026-11-20 publication record](rtl-analyzer-0.3.0-publication-2026-11-20.md) supersedes current status, final README/artifact hashes and next actions below; this snapshot remains historical evidence.

## Architecture and compatibility

`npx rtl-analyzer` installs/runs the existing public bin `dist/standalone-cli.js`. With no arguments it generates external reports and requests the default browser; `scan [path]` delegates to bundled `dist/cli.js`. New `rtl-analyzer preview` lazily starts bundled `dist/preview-companion.js`. Direct aliases `rtl-scanner` and `rtl-preview` remain available. There is no network bootstrap, source checkout or second public dependency at consumer runtime. `bootstrap.js` in the file list is a Bootstrap CSS utility detector, not a downloader.

The build uses this repository's standalone router and a Git submodule pinned to implementation commit [`0a10d65b`](https://github.com/FoushWare/enterprise-rtl-migration-lab/commit/0a10d65bf3bf7a7aa7a9fa287263bde9639ab1db). That commit descends from the completed `8ea82bfbcba1e46bc229121210e0fec79e8cf08b` checkpoint. Its `@atlas/rtl-scanner@0.1.0` manifest is private and is not published separately. Old scanner sources in this repository are preserved; release scripts/build use the pinned implementation. `prepack` verifies the source commit and clean tracked state, stages the implementation plus router, removes stale generated modules and compiles into the existing package layout. Consumers receive compiled JS only. Developers/CI must initialize submodules.

Preserved: default dashboard, `scan .`, explicit `--root`, four formats, external output, source embedding, help/version and exit semantics (0 complete; 1 requested findings gate; 2 incomplete/error). Published recursive discovery, React/Emotion/MUI static syntax, utilities and bounded SCSS detection are carried into the implementation. Explicit project config takes precedence. Utility classes remain detection-only; report IDs/counts now use per-token `RTL.UTILITY.PHYSICAL` findings and cannot transfer historical approval. SCSS repairs are unsupported. Reports require an existing external directory; the old README's `./rtl-report` examples were wrong and now have a verified exit-2 regression check. Preview/review requires project scripts, mappings, dependencies and Chromium; no-argument static output does not start those services. No general Next.js/mocking adapter or automatic routing is claimed.

Ahmed's supplied `RTL_ANALYZER_README.md` (SHA-256 `b9f1e6eb47477148ac85f43b71474cbf4dcf2fb6836a49697a4882f609748d21`) is integrated into the package README. Batch preparation wording now matches **Prepare all, then review**: isolated copies, explicit acceptance, accepted-only validation, separately confirmed source Apply and receipt-backed rollback. The logical-spacing example is qualified for horizontal writing mode. Unavailable screenshots/videos were not invented.

## Exact artifact and checks

- Tarball `rtl-analyzer-0.3.0.tgz`: **67 files; 175,032 compressed / 662,326 unpacked bytes**.
- SHA-256: `4d166ea9118fa4acaec703ff0edf4b51b5051b36dd53aa367e049c067986c60e`.
- SHA-1: `002e6aebb9b7e2737b0d2b2920bfe5a053211780`.
- Integrity: `sha512-zInGqBXO7HnIwP6PZhIQOCbnzK0hPS578q/PmUDQgyQEnu0+9vj9GZew2FwPr7Gp4ZjHK4Kmeogo7t+LGLZTcQ==`.
- [Actual pack file list, sizes and modes](rtl-analyzer-0.3.0-pack.json). Only 64 `dist/*.js` modules, README, LICENSE and package metadata. No examples, videos, source, tests, history, state, dependencies, reports or backups. Tarball inspection also found no local checkout paths or common npm/GitHub token prefixes.
- A second `npm pack --json` produced byte-identical output. Runtime and package metadata are unchanged after these checks; subsequent changes are release evidence/memory only.

Host: macOS arm64; Node **v22.21.1**, npm **10.9.4**. Consumer has `rtl-analyzer` **0.3.0**, TypeScript **5.9.3**, Vite **6.4.5**, React/React DOM **19.1.0**, Playwright **1.64.0**. Dependency versions are recorded in [consumer evidence](rtl-analyzer-0.3.0-consumer.json).

| Check | Exit / observed result |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund`, then normal `npm ci --no-audit --no-fund` in release checkout | 0; 709 packages installed; normal install scripts also completed. |
| `npm run rtl:scan:typecheck` | 0; pinned implementation strict checks. |
| `npm run rtl:scan:test` | 0; **397/397, 33 files**, executed inside the release checkout's pinned source. |
| `npm run rtl:scan:build` | 0; stages/compiles the actual public package. |
| `npm pack --json --pack-destination /private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-release-prep-20261119-lbq2jyjl` in `packages/rtl-analyzer` | 0; exact artifact above. |
| `node implementation/tests/e2e/package-consumer-smoke.mjs /private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-release-prep-20261119-lbq2jyjl/rtl-analyzer-0.3.0.tgz --wrapper` | 0; complete public wrapper consumer journey. |
| `npm run rtl:cli:package:smoke` | 0; actual publication-gate script repacks and reruns both wrapper workflows on a fresh disposable target. |
| `npx eslint packages/rtl-analyzer/build.mjs scripts/consumer-smoke.mjs tools/rtl-scanner/src/standalone-cli.ts` | 0; all changed wrapper code. |
| Root `npx eslint . -f json` | **1; 339 errors / 0 warnings**: 268 in pinned implementation, 65 in preserved legacy source/tests, 6 in generated duplicate runtime JS. No rule weakened or failure hidden. |

The lab's implementation checkout separately passes typecheck/build, 397 scanner tests, 9 app tests, app build and the installed **internal scanner** journey. Default browser discovery now exits 0 (171 tests / 43 files): the deleted phase6 temp report dependency was replaced by the existing disposable installed-package harness and a serial `test:e2e:journey` config. These internal scanner checks are not substituted for the wrapper journey above. Root lab lint still fails (277 errors: 268 tracked plus 9 local ignored floorplan helper errors). Historical memory validation fails on 47 required/6 optional missing asset links; those artifacts were not regenerated.

## Real consumer results

Target/evidence: `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-package-consumer-2jwAq6`, outside every worktree. Installation uses the final tarball with `npm install --save-dev --ignore-scripts --no-audit --no-fund`; no repository source/dist entry is invoked. All scan commands use installed `npx --no-install rtl-analyzer ...`; the service uses installed `node_modules/.bin/rtl-analyzer preview` with six external state/backup overrides. Python 3 serves external reports at 127.0.0.1:4320, Companion at 4318, original Vite at 4215 and candidates in 4202–4212. Commands/arguments/exits, installed versions, source/report hashes and workflow receipts are in [consumer evidence](rtl-analyzer-0.3.0-consumer.json), with [extra positional-path/alias/output checks](rtl-analyzer-0.3.0-extra-checks.json).

Default no-argument invocation, help/version, preview help, JSON/Markdown/structured-Markdown/dashboard all exit 0. Invalid preview option exits 2; `--fail-on-findings` exits 1 as intended. Scan: complete, 5 files, 6 findings, 0 diagnostics. Dashboard emits all four artifacts. Default OS browser opener success is command-level evidence; no Safari rendering certification is inferred.

Both **one-by-one** and **apply-first** verify real LTR/RTL frames and computed margin placement. Both begin Pending and preserve original hashes through candidate preparation/validation. Each passes six checks: typecheck/build/test/scanner/runtime LTR/runtime RTL. Approving only one finding recomposes a one-patch candidate; source Apply changes only `margin-left:18px` to `margin-inline-start:18px`, retaining other proposals. Each creates one receipt; rollback restores all five scanned-file hashes exactly and starts fresh Pending / Not run state. CSS SHA-256: original/restored `7476bfab6725db6703a02e3788323355aecfab320900d0939af6e2986291e4d3`, applied `57c0c5e5cbd1481d07e8a4058fac12b59012c5aa65d1451af552c8076099ff2c`. Six foreign/originless writes are denied (403), and no browser page errors occur. Superseded/Rolled back/history states remain separate. Owned services are terminated and awaited in the runner's finally block; individual service exit codes are not captured, while overall harness exit is 0. Targets/history/backups remain offline for inspection.

## Remaining acceptance and publication procedure

- Ahmed's personal visual/workflow acceptance is **[ ]**; automated approvals do not mark it complete.
- Repository lint is explicitly failing as above. The existing release workflow does not run root lint; skipping it there is not a lint waiver. Resolve or explicitly adjudicate these existing blockers before claiming an unqualified release gate.
- macOS/Chromium/npm and disposable integration targets are verified. Linux runtime/Windows/Safari/other Node or package-manager combinations and an existing real-world consumer application are not certified by this run. The retained Windows CI leg has not been executed against this new implementation and must be reviewed before claiming cross-platform readiness. Protected operations/report publication use the trusted POSIX filesystem contract. No power-loss/multiprocess coordination guarantees; historical immutable Before runtime and general test-change coverage remain unavailable/Unknown.
- Historical missing assets remain missing; the prior QA-cleanup incident is not repaired or rewritten. Local examples/videos/state stay outside npm.

Inspected triggers **before pushing**: this repo's only publishing workflow is `.github/workflows/publish.yml`, triggered by a GitHub **release.published** event. It validates release tag versus package version, runs build/tests/consumer smoke, rejects existing npm versions, then publishes `packages/rtl-analyzer` through existing OIDC. Plain branch pushes cannot trigger that publication; CI push is limited to `feat/standalone-cli-packaging`, and PR CI only verifies. No deployment config or active push hook was found. The lab's only workflow verifies push/PR and does not publish/deploy. Normal preparation branch pushes are safe; never force-push. No release/tag/npm publish/deployment occurred.

**After separate publication approval and acceptance of the stated blockers:**

1. Review/merge `codex/rtl-analyzer-0.3.0-prep` into release-repository `main` normally. Verify the pinned implementation commit and unchanged candidate package; obtain required CI/platform acceptance. Keep `8ea82bf` and implementation branch history intact.
2. From that exact checkout: `git submodule update --init --recursive`, `npm ci`, `npm run rtl:scan:typecheck`, `npm run rtl:scan:test`, `npx playwright install --with-deps chromium`, `npm run rtl:cli:package:smoke`. Inspect pack manifest and hashes. Recheck `npm view rtl-analyzer version` and `npm view rtl-analyzer@0.3.0 version` (expect E404); any collision requires a new version and versioned candidate retest.
3. Create GitHub release tag **v0.3.0** at the reviewed exact merge commit and publish that GitHub release. For example, only after approval: `gh release create v0.3.0 --repo FoushWare/rtl-analyzer --target <reviewed-merge-SHA> --title "RTL Analyzer 0.3.0" --notes-file <reviewed-release-notes.md>`. This command creates a tag/release and triggers npm publication, so it has **not** been run.
4. Let `.github/workflows/publish.yml` perform its existing `npm publish --access public` using OIDC from `packages/rtl-analyzer`. Do not also publish the internal implementation or run a parallel manual publish. Verify Actions, npm dist-tag/version/integrity, then repeat the wrapper consumer check against the registry version. An OIDC failure requires maintainer action; no credential fallback is introduced.

Release-repository memory validator is not present; an attempted direct invocation exits 2 (missing script). The pinned lab validator was executed separately and reports the historical missing assets above. No memory validation pass is claimed for this release repository.

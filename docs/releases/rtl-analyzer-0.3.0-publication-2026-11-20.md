# RTL Analyzer 0.3.0 publication

**Published and registry-verified 2026-11-20:** [rtl-analyzer 0.3.0](https://www.npmjs.com/package/rtl-analyzer/v/0.3.0), `latest: 0.3.0`. The user explicitly authorized finalizing and publishing the existing public package through ordinary PR review/merge and the existing GitHub release → OIDC workflow. Existing repository lint debt and deferred broader platform/real-world acceptance are accepted for this bounded release. Ahmed manual visual/workflow acceptance **[ ]** remains unchecked. This supersedes current-status claims in the [November 19 preparation snapshot](rtl-analyzer-0.3.0.md), preserving its historical evidence.

## Reviewed scope

Release checkout `/Users/a.fouad/rtl-analyzer-0.3.0-prep`, branch `codex/rtl-analyzer-0.3.0-prep`; application/runtime source unchanged; the test-only fixture correction below was necessary for Linux CI. Public package `rtl-analyzer` stays **0.3.0**. Its initial implementation submodule was pinned to [`0a10d65bf3bf7a7aa7a9fa287263bde9639ab1db`](https://github.com/FoushWare/enterprise-rtl-migration-lab/commit/0a10d65bf3bf7a7aa7a9fa287263bde9639ab1db), descending from preserved checkpoint `8ea82bfbcba1e46bc229121210e0fec79e8cf08b`. The internal `@atlas/rtl-scanner` manifest remains private.

The supplied `RTL_ANALYZER_README(1).md` product text is integrated into concise root and npm READMEs. Batch mode is corrected to **Prepare all, then review**; isolated Pending preparation, explicit acceptance, accepted-only validation and separate source Apply are stated accurately. Scan-only versus configured review, Node requirement, horizontal writing-mode qualification and limitations are explicit. Detailed verified setup is retained in the [developer testing guide](../guides/developer-testing.md). Unrelated copied page/account data was excluded; no screenshot/video was fabricated. [Release notes](rtl-analyzer-0.3.0-release-notes.md) describe final behavior.

## Pre-CI local artifact and gates (superseded by the fixture correction below)

Host: macOS arm64, Node **v22.21.1**, npm **10.9.4**. Evidence root: `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-publish-20261120-j4gx4n2t`. This final artifact supersedes the November 19 README-dependent tarball.

- [Actual pack manifest](rtl-analyzer-0.3.0-pack-2026-11-20.json): **67 files, 171,699 compressed / 653,804 unpacked bytes**; 64 runtime JS files plus README, LICENSE and metadata.
- SHA-256 `d745064bf773e3283065e4be21d0f1513cfbffebc628ddf1880de11f4160ce42`.
- SHA-1 `44c5bedf3bd3d41d8d2814da3109e183c927ca8f`.
- Integrity `sha512-1dYWOLfy2mlffwCek+qPCz+aE14FvDOl9OeOMoSZxCZpLi0hCqdBdLhOq0uaW5xNa6zQApc8W9f1OdQ2pqXT3Q==`.
- Inspected the actual archive allowlist and contents for local checkout paths/common credential prefixes: passed. No source, examples, videos, tests, state, reports, backups or dependencies enter npm.
- `npm ci --no-audit --no-fund`, `npm run rtl:scan:typecheck`, `npm run rtl:scan:build`, `npm run rtl:scan:test` (**397 tests / 33 files**), `npx playwright install chromium`, final `npm pack --json`, scoped wrapper ESLint and **`npm run rtl:cli:package:smoke` all exit 0**.
- Root `npx eslint . -f json` exits **1: 339 errors / 0 warnings** (268 pinned implementation, 65 preserved legacy, 6 generated duplicate JS). No rule/ignore/check was weakened. An initial overlapping lint/build attempt exited 2 on a removed temporary staging file; the serial rerun above produced the complete baseline.

[Installed wrapper consumer evidence](rtl-analyzer-0.3.0-consumer-2026-11-20.json) records `/private/var/folders/fq/64_hc1kd09g0ysrzs_gg6ylh0000gn/T/rtl-package-consumer-We9r0f`, outside all worktrees. Both independently packed artifacts have the identical SHA-256 above. Installed help/version/default dashboard, four scan formats, preview help and actual companion pass; expected invalid option exit 2 and findings gate exit 1 are retained. Scan: 5 files, 6 findings, 0 diagnostics, complete.

Both review modes start Pending, prepare without changing source, verify real LTR/RTL frames and computed spacing, then pass typecheck/build/test/scanner/runtime-LTR/runtime-RTL. Accepting only one finding recomposes one patch. Separate source Apply changes only that declaration and creates one receipt per mode. Rollback restores all five source hashes exactly and starts fresh Pending / Not run state. Six unauthorized writes return 403; no browser page errors. Owned services are terminated and awaited; individual service exit codes are not captured. Automated fixture decisions do not substitute for Ahmed's manual acceptance.

## Initial availability and publication plan (historical)

Before finalization: remote `main` was `253912c85dfadda09abb42361b9a9776dc9916eb`, the preparation branch was `ffe979b968984cdeb9a1c73ac33a80b8dddf641d`. GitHub API reported main unprotected, no rulesets, no existing preparation PR, no v0.3.0 tag/release; npm lookup returned E404 for 0.3.0. Policies/version availability must be rechecked immediately before publication.

At this preparation snapshot, publication was pending ordinary PR CI/review and merge. Only `.github/workflows/publish.yml` on **release.published** may publish npm. It validates tag/version, installs submodules, runs typecheck/build/tests/Chromium/full wrapper smoke, checks version availability and uses OIDC. No manual npm publish or protection bypass is authorized. Final merge/tag/Actions/npm provenance and registry-installed verification will be recorded after execution.

## Accepted limitations

The retained Windows CI leg must be reported honestly; historical Windows milestones do not certify this implementation. Protected source/report operations use the trusted POSIX filesystem profile and Windows protected operations are unsupported. Linux full installed-wrapper runtime verification subsequently passed, as recorded below. Safari, other package managers, general framework compatibility, an existing real-world consumer and Ahmed's manual acceptance remain unverified. Historical Before runtime is unavailable after Apply, test-change coverage is Unknown, and trusted project scripts/single-process coordination remain assumptions.

Historical asset/memory links remain unresolved; no historical files were regenerated. Release repository has no memory validator script. Lab validation and current publication evidence will be recorded in its affected memory entries only.

## CI fixture correction

The [initial PR CI](https://github.com/FoushWare/rtl-analyzer/actions/runs/44673696803) failed on Ubuntu: 32/397 scanner tests attempted to create fixtures under macOS-only `/private/tmp`. Windows also failed (73/397), including unsupported POSIX/path semantics. Neither result is presented as a pass. The source correction uses `realpathSync(tmpdir())` for real temporary directories in four scanner test files, preserving every assertion and production guard. No application/runtime source changed and no test was skipped.

Final implementation pin: [`8d3946a40b024a042cf315aa33cfcb560e69dc75`](https://github.com/FoushWare/enterprise-rtl-migration-lab/commit/8d3946a40b024a042cf315aa33cfcb560e69dc75), a test-only descendant of `0a10d65b` on `codex/rtl-analyzer-0.3.0-ci-fixtures`. Local strict typecheck and all 397 scanner tests pass after this correction. Final package/consumer evidence follows; earlier November 20 artifact entries above remain the original pre-CI results.

Final corrected artifact: [pack manifest](rtl-analyzer-0.3.0-final-pack-2026-11-20.json), **67 files, 171,699 compressed / 653,804 unpacked bytes**, SHA-256 `19c575c0468b93de150c6e7e8db039231a4a22550bfb355565b23652a20dbfb8`, SHA-1 `b86f96da4c38d280c10dc370e98e7a310d6311fd`, integrity `sha512-+dUfRsji8JmCQd0VODS+PZ3CulTZQo0hBHcJ5DmMTrQ90wwXZUhjvCUY5nHjCz4pQ9HFc4jrSQw5bYYG6UASTg==`. Archive comparison proves all runtime/README/license bytes match the pre-CI artifact; only package metadata's implementation commit changes. Actual allowlist and sensitive-pattern inspection pass again.

The actual `npm run rtl:cli:package:smoke` exits 0 on this corrected artifact. [Final installed consumer evidence](rtl-analyzer-0.3.0-final-consumer-2026-11-20.json) records both complete modes and the same six checks, accepted-only Apply, receipt counts, five-file exact rollback, six denied writes and no browser page errors. The independent prepack and smoke pack are byte-identical. Current PR CI must be rechecked at the new head before merge.

## Ordinary merge and GitHub release

[PR #11](https://github.com/FoushWare/rtl-analyzer/pull/11) was reviewed and ordinarily merged at **`b4c19d3857dd961b5d9e72fe0d36f47f5999cd7f`** on 2026-11-20. Its final head was `fd7d736c2aac5135eaf1844b2230fd4a93eee871`; the merge tree is identical. Review was a scoped source/workflow/pack/consumer audit; Copilot reported insufficient review quota and supplied no independent approval. No required review policy exists. Main was unprotected with no rulesets; no admin override, force push or protection change was used.

[Final PR CI](https://github.com/FoushWare/rtl-analyzer/actions/runs/44674349533): **Ubuntu passes** typecheck/build, all 397 scanner tests, Chromium installation and full wrapper smoke. [Linux consumer evidence](rtl-analyzer-0.3.0-linux-consumer-2026-11-20.json) records Node v22.23.4, both complete review modes and exact Apply/rollback. **Windows fails**: 54 failed / 342 passed / 1 platform-conditional skipped in 33 files, including unsupported POSIX/path semantics. It does not reach Chromium/consumer smoke. The retained check remains visibly failing, with no test/check/rule weakened to obtain a green result. This is within the user's explicitly accepted deferred broader-platform scope, and does not certify Windows.

Immediately before release creation, npm 0.3.0/tag/release availability were checked again (E404/404/absent), and main's exact merge SHA was verified. [GitHub v0.3.0](https://github.com/FoushWare/rtl-analyzer/releases/tag/v0.3.0) was published at that merge commit. Its release event starts [Publish package run 44674724255](https://github.com/FoushWare/rtl-analyzer/actions/runs/44674724255), which independently reruns all mandatory Linux checks before OIDC publication. No manual npm publish was executed.

## Registry verification completed

[Publish run](https://github.com/FoushWare/rtl-analyzer/actions/runs/44674724255) **succeeded** with Node v22.14.0/npm 11.5.1, all 397 scanner tests and [both-mode publication-gate consumer evidence](rtl-analyzer-0.3.0-publish-consumer-2026-11-20.json). [Run/job/step results](rtl-analyzer-0.3.0-publish-run-2026-11-20.json) preserve every mandatory gate. npm accepted the OIDC publication and emitted signed provenance. Its asynchronous processing and a cached 404 briefly delayed archive availability; normal registry installation now succeeds. No republish/retry publication was attempted.

[Registry verification](rtl-analyzer-0.3.0-registry-verification-2026-11-20.json): `version` and `latest` are **0.3.0**, `gitHead` is **`b4c19d3857dd961b5d9e72fe0d36f47f5999cd7f`**, matching the tag and merge. Registry tarball: **67 files / 653,804 unpacked bytes**, SHA-256 **`bb2cb3ce5cd261c4371df3286f691d9cc4eb27bc5f36068dee1c387ece7b16d8`**, SHA-1 **`173d7609bb9d2375d8654ca51908fddc6acc4e49`**, integrity **`sha512-Xe0LJaOMlFSRThreLzF9dHxLW3huU6qpC7CyjxTtkn+LVkE/lV4AOBWzxODjZMa4rClv81vA8BtpHaOnyPIxuA==`**. The downloaded archive matches the Linux publication-gate tarball byte-for-byte. All 67 member contents and inspected headers also match the local macOS artifact, although compressed archive bytes differ between local packaging and Linux. npm normalized `repository.url` in registry metadata; there is no runtime content change.

The signed SLSA provenance names `refs/tags/v0.3.0`, `FoushWare/rtl-analyzer`, `.github/workflows/publish.yml`, this exact merge SHA and Actions run **44674724255 / attempt 1**. Both attestation subject SHA-512 digests match the downloaded archive. A fresh registry-version install's **`npm audit signatures` exits 0**; its output and exact command exits are retained in the registry verification evidence.

`npm pack rtl-analyzer@0.3.0 --ignore-scripts --json --pack-destination <external>` downloads actual registry bytes, then the existing wrapper harness installs that archive in a fresh disposable target. [Registry consumer evidence](rtl-analyzer-0.3.0-registry-consumer-2026-11-20.json) proves both full review modes, all six checks per mode, explicit accepted-only one-patch Apply, one receipt per mode, exact five-file rollback and fresh Pending / Not run state, six denied writes and no browser page errors. Harness exit **0**. A separate **`npm install --save-dev rtl-analyzer@0.3.0`**, installed `--version`, `--help`, read-only `scan . --format json`, and signature audit all exit **0**. The lockfile integrity equals registry integrity. Every service started by the harness is terminated and awaited; individual service exit codes are not captured.

Developer commands from a frontend project's root (Node >=22.12):

```sh
npm install --save-dev rtl-analyzer@0.3.0
npx --no-install rtl-analyzer --version
npx --no-install rtl-analyzer scan . --format json
npx --no-install rtl-analyzer
```

Live review is configured separately using the [developer testing guide](../guides/developer-testing.md): real project checks, source/selector/route bindings, Chromium, source-enabled external reports, Python server at 4320 and companion at 4318. No new example project or Nx infrastructure was added. **Ahmed manual acceptance [ ]** remains unchecked; accepted lint/platform/real-world limitations above remain visible.

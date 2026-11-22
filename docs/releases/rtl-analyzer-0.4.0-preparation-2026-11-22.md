# RTL Analyzer 0.4.0 preparation record (2026-11-22)

**Not published.** Prepared locally on `codex/consolidate-examples` (wrapper base `9e72d17`, working tree uncommitted). Facts below were executed in this workspace (macOS arm64, Node 22.21.1, npm 10.9.4).

## Source
- Published latest is 0.3.0 (tag `v0.3.0` = `b4c19d3`). `packages/rtl-analyzer/package.json` is now 0.4.0 and pins implementation `aa8873ebaee0f0c3a1448462eaf83e21a90ab89c`.
- `aa8873e` descends from `d55daba` (finding-specific Live After; candidate runtime cleanup after Apply/Rollback/shutdown) and adds a bounded retry for the cold-start `Execution context was destroyed` failure. It is a **local submodule commit; neither it nor `d55daba` exists on the implementation remote**, so publish.yml (`submodules: true`) cannot check it out until they are pushed.
- The wrapper branch is 106 commits ahead of `origin/main`; the release must come from a merge to `main`.

## Gate regression found and fixed
`npm run rtl:cli:package:smoke` failed on `d55daba` and `54648af` (preview preparation failed, execution context destroyed) and passed on the 0.3.0 pin `8d3946a`. Bisect: first bad `cb75b88`. Cause: cold Vite candidate reloads once ("optimized dependencies changed") during evidence `page.evaluate`. Fix in `aa8873e` (`page-navigation.ts`, 3 tests).

## Checks
- `rtl:scan:typecheck` clean; `rtl:scan:build` ok; `rtl:scan:test` **426 tests / 39 files** pass.
- `rtl:cli:package:smoke` exit 0 on the final tree (both review modes, accepted-only Apply, exact rollback).
- Tarball `rtl-analyzer-0.4.0.tgz`: 74 files, 202,330 bytes packed / 768,517 unpacked, sha256 `d8cdc5532f1ceba40464c8c4db26858afb5a0d35f559f235827aa31c6955abbb`, sha1 `1beef13d9f73e48109abdd909751ec016aafcd2b`. Contents: `dist/*.js` (71), README, LICENSE, package.json; three bins present; no examples, dependencies, tests, maps or secrets/local paths.
- Browser (Playwright/Chromium, installed tarball, disposable copies): Workspace Integration one-by-one (both finding orders), batch; Admin Dashboard `.dialogTitle` one-by-one and batch; Account Checkout and Foundations one-by-one and batch. Each: Validate, explicit Apply (one file), hash-exact rollback, candidate ports released after Apply, no leftovers after double SIGINT. Interaction Playground: manual-only. Bilingual Storefront: runtime unavailable (unsupported).
- Not verified: Windows, Safari, other browsers, human acceptance, published-registry install (pending publication), lint (existing debt not rerun).

## Environment note
A stale Foundations walkthrough Vite server (PID 8098/8057, port 4215) was stopped with the user's approval to run the smoke.

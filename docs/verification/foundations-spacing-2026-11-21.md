# Foundations spacing acceptance repair

Verified 2026-11-21. Local acceptance only; release and examples preparation pending.

Authoritative wrapper `/Users/a.fouad/rtl-analyzer-0.3.0-prep`, wrapper pin commit `22ff371`; implementation `9668831db6e4d42790a607e05c4bee2897a7ba7e`. Scoped spacing repair `15df1d8`; same-origin linked stylesheet validation `72f7aa2`; source-based event-driven chooser repair `9668831`. No obsolete dirty checkout used. No push or publication.

The old spacing transformer rejected direction declarations anywhere in a stylesheet. This was unchanged from the previously verified Field Notes package; that fixture was not Foundations. Syntactic spacing proposals now defer actual direction/cascade/inheritance/active-condition resolution to server-observed computed target context in original and candidate, configured LTR and RTL. Preparation verifies scoped evidence; validation and Apply independently retain runtime/source/config identity checks, horizontal writing mode, candidate freshness and accepted-only composition. Local RTL overrides are valid; active inherited vertical writing modes and missing targets fail verification. Existing same-rule spacing/cascade conflicts remain rejected. Syntactic proposal is not semantic approval or proof for unobserved application states.

Foundations also omitted package-lock.json from candidate copyPaths; corrected only in disposable copies and pending walkthrough configuration, without changing source baseline. Generic candidate validation recognized only Vite style elements; it now verifies same-origin linked source stylesheets too. No validation checks were removed. The example config invokes `node --check src/app.js` for its three configured checks; this proves syntax only, not a comprehensive application test suite.

Persistent supervisor `/Users/a.fouad/rtl-analyzer-dashboard-run/serve.cjs` now copies all generated report files from one installed-CLI scan before exposing them, including adjacent JSON rather than updating HTML alone. Browser embedded input/policy digests match raw JSON, and successful companion preparation demonstrates the same current source identity. Startup occurs before the HTTP listener opens; preexisting listeners are refused.

Evidence root `/Users/a.fouad/rtl-analyzer-dashboard-run/acceptance-repair`:
- Normal wrapper package prepack (pinned clean Git source), `package/rtl-analyzer-0.3.0.tgz`, SHA256 `575bb69a4d8d5577f3d2dbd2840d03bcd5fbe28445e48b4279db8f0450e5d9ce`. All 72 archive files match installed consumer bytes.
- `walkthrough-results.json`, `walkthrough-final.log`: both modes passed real isolated candidate, LTR/RTL measurements, persisted explicit one-item approval, Passed validation, explicit accepted-only Apply (one receipt), hash-exact rollback.
- `context-results.json`, `context-final.log`: local RTL override passes; active media-conditioned ancestor vertical mode fails; missing target fails.
- `browser-results.json`, `browser.log`: Chromium live frames verified LTR/RTL; five theme options; Nord commit, reload/Resume, candidate remains ready; HTML/JSON identities equal. Screenshot `pending/before-after-nord.png`. No Safari certification claimed for this repair.
- Strict scanner typecheck passes; full final scanner suite 37 files / 413 tests pass (`scanner-final.log`). Count differs from prior 414 because two tests requiring blanket local-direction rejection were replaced with a three-scenario scoped proposal regression.

Finding `RTL.CSS.PHYSICAL:b8a43565190b1c1d499c100e`, src/lab.css `.physical-start`, proposal `margin-left:auto` → `margin-inline-start:auto`. At 1280x800 LTR x stays 635.578125; RTL original x 712.890625 vs candidate 558.609375. Original RTL left/right auto margins split available space; candidate keeps the intended inline-start auto margin. Semantic approval remains explicit. Source CSS hash before/after rollback matches in each mode.

Pending walkthrough: http://127.0.0.1:4320/rtl-report-dashboard.html?finding=RTL.CSS.PHYSICAL%3Ab8a43565190b1c1d499c100e . Project is the disposable `acceptance-repair/pending/project`, original example preserved. Companion http://127.0.0.1:4318/health . Ownership check `node /Users/a.fouad/rtl-analyzer-dashboard-run/stop.cjs --check`; stop omits --check; restart `node /Users/a.fouad/rtl-analyzer-dashboard-run/serve.cjs`.

Remaining geometry/order, transforms, positioned edges, corner and shadow semantics have no newly implemented transformations. Border ownership, rendered target availability, complex shorthands and general CSS cascade conversion remain outside this scoped repair. No claim that every Foundations finding has an automatic candidate.

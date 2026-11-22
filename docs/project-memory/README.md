# RTL Analyzer project memory

Durable navigation for Codex sessions. Read this index first; source code, manifests, and executed output are authoritative, while historical reports are labeled.

## Current status

**Verified 2026-11-20.** Public `rtl-analyzer` **0.3.0** is published and registry-verified; GitHub tag, npm `gitHead` and signed provenance match merge commit `b4c19d3857dd961b5d9e72fe0d36f47f5999cd7f`. The [publication record](../releases/rtl-analyzer-0.3.0-publication-2026-11-20.md) owns final artifacts, OIDC run, fresh registry install, full both-mode consumer and signature verification. Existing lint debt and deferred broader acceptance are explicitly accepted. Windows CI remains failing/unsupported for protected operations, and **Ahmed manual acceptance [ ]** remains pending. The [November 19 preparation record](../releases/rtl-analyzer-0.3.0.md) remains historical. Prior M4D Windows milestones below do not certify this release.

## Documents

- [0.4.0 preparation](../releases/rtl-analyzer-0.4.0-preparation-2026-11-22.md) — prepared 2026-11-22, **not published**: smoke-gate regression fixed in local implementation commit `aa8873e` (unpushed), both-mode browser verification on the installed tarball, new README/screenshots and example testing guide. Awaiting approval of version/publish target.

- [Workspace Integration fixes](../../examples/workspace-integration/README.md#third-pass-analyzer-fixes-2026-11-22) — verified 2026-11-22: one-by-one Live After limited to the selected finding, candidate runtimes released after Apply/Rollback and on repeated shutdown signals; local implementation commit `d55daba` (wrapper pin updated, not pushed). Human acceptance pending.

- [Northstar WebKit acceptance](../verification/northstar-webkit-acceptance-2026-11-22.md) — verified 2026-11-22: exact installed wrapper, eight WebKit candidate previews, both review workflows, rollback conflict protection, and a running pending walkthrough. Links to setup, inventory, and Claude handoff.

- [Northstar configured CSS proposals](../verification/northstar-configured-previews-2026-11-22.md) — verified 2026-11-22: live component restoration, project-declared proposal intents, pinned wrapper installation, independent project coverage, and accepted-only Apply with exact rollback in both modes. Human walkthrough pending.

- [Foundations per-finding acceptance inventory](../verification/foundations-finding-inventory-2026-11-21.md) — verified 2026-11-21: symmetric padding false positive removed, 10 actionable findings, manual-only rendering, runtime information exclusion, pinned-source package and Safari/Chromium evidence.

- [Foundations spacing acceptance repair](../verification/foundations-spacing-2026-11-21.md) — verified 2026-11-21: pinned-source package, scoped runtime direction checks, both-mode Apply/exact rollback, matching reports and pending local walkthrough; release preparation pending.

- [Batch review, operation loaders and color themes](../verification/batch-review-themes-2026-11-21.md) — verified 2026-11-21: server-verified multi-file batch preparation/selected approval, five dashboard themes, Session details placement, final installed package, 414 scanner tests and 10 browser tests; running independent walkthrough and ownership-safe stop instructions. Human acceptance pending.

- [Guided-review operation UX acceptance](../verification/guided-review-acceptance-2026-11-21.md) — verified 2026-11-21: explicit entry, journaled validation/Apply, authoritative summary, protected remaining review and Deferred carry; final installed package, 412 scanner tests, eight browser tests and live ownership-verified walkthrough. Human acceptance pending.

- [Review-mode entry and restoration](../verification/review-mode-entry-2026-11-21.md) — verified 2026-11-21: both modes, saved-session chooser behavior, per-review draft restoration, both-mode cross-file navigation, final package/browser/Apply/rollback evidence and fresh manual tab; human acceptance pending.

- [Project-wide review navigation](../verification/cross-file-review-2026-11-21.md) — verified 2026-11-21: shared scope/progress model, explicit cross-file/filter continuation, unresolved summary routes, final installed package/browser/Apply/rollback evidence and running URLs; human acceptance pending.

- [Preview mappings and sidebar decisions](../verification/preview-status-2026-11-21.md) — verified 2026-11-21: independent JSX targets, intentional unmapped state, persisted indicators, final installed package/browser/Apply/rollback evidence and running URLs; human acceptance pending.

- [Dashboard usability verification](../verification/dashboard-usability-2026-11-20.md) — verified 2026-11-20: final installed local package, browser review/Apply/rollback results, screenshots and running manual environment; human acceptance pending.

- [Architecture](ARCHITECTURE.md) — implementation boundaries and transactions.
- [Milestones](MILESTONES.md) — M1 through M4D.2b historical timeline and readiness.
- [Security](SECURITY.md) — trust, identity, authorization, and recovery.
- [Testing](TESTING.md) — commands, suites, fixtures, and constraints.
- [Windows verification](WINDOWS-VERIFICATION.md) — M4D.3 checklist.
- [Handoff](HANDOFF.md) — dated transfer instructions and next action.

Run `python3 docs/project-memory/validate.py` when available to check links and source freshness.

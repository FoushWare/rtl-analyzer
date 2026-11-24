# Live Preview stability v0.6.1 — in progress

**2026-11-24. Unreleased.** Branch `fix/live-preview-stability-v0.6.1` in both repositories. Implementation pin `94a14e7` is local only (three commits on `fix/live-preview-stability-v0.6.1`, based on `819b733`, which is not on the implementation repo's `main`). Browser reproduction and acceptance are blocked by a live `npx rtl-analyzer` session on ports 4216, 4318 and 4320, which was not touched. Next action: when those ports are free, reproduce the Before/After behaviour in a disposable Foundations Lab copy, run Phase 7, then decide the implementation PR base. The [verification record](../verification/live-preview-stability-v0.6.1-2026-11-24.md) owns evidence.

---

# Default Live Preview startup — v0.6.0 candidate

**Verified 2026-11-24 (candidate, not yet released).** Interactive `npx rtl-analyzer` starts the configured dev server by default; dependency preflight runs before the startup notice; non-interactive runs need `--approve-project-scripts`; `--no-project-scripts` opts out. The [verification record](../verification/default-preview-startup-2026-11-24.md) owns evidence, the origin/main baseline and the known pre-existing root typecheck and Nx build failures.

Deferred to later releases: child-process stderr capture (needs a pinned implementation change), Guided Live Preview recovery (#32), Windows publication (#28). The pinned submodule was not changed.

---

# Batch-review and themes acceptance continuation

**Verified 2026-11-21. CONTINUE.** Approved local dashboard implementation and automated/browser verification are complete; **Ahmed human acceptance remains pending**. No push/publish/tag/deploy is authorized.

The [current verification record](../verification/batch-review-themes-2026-11-21.md) owns causes, scoped fixes, exact package provenance, 10 passing installed-package browser tests, 414 scanner tests, screenshots, live URLs and ownership-aware stop commands. The chooser picker continuation is implementation `a59e9dc5750c11df8bb04d66c4087983b7f5008d`; packaging pin commit `b4720aa`; package-17 SHA-256 `4e834793bff2415ebe129b94b2557c3ae389aed03421c880e0e6bba7b47a365a`. WebKit is unavailable locally, so no Safari pass is claimed. Use authoritative wrapper `/Users/a.fouad/rtl-analyzer-0.3.0-prep` and nested implementation; do not use the obsolete dirty checkout.

Next: Ahmed opens `http://127.0.0.1:4320/rtl-report-dashboard.html?run=batch-10`, explicitly resumes the fresh prepared batch (7 ready, 0 approved, 1 deliberate unmapped blocker), checks themes, mapped padding `.reject-me`, selected approval, validation and explicit source destination confirmation. Manual and bulk paths, accepted-only Apply, lost-response reconciliation and protected exact rollback have automated browser evidence. Services remain running under supervisor 50348; use only the ownership-checking stop script linked in the record. Preserve prior user Applied projects, workflows, receipts, drafts and unrelated archive edits. No human acceptance is implied.

A restarted interrupted server operation stays Uncertain and mutation-blocked pending inspection; deliberately unmapped direction-dependent changes still require real mapping/evidence. Sampled theme contrast/focus/narrow layout checks passed; this is not a full accessibility or Safari certification.

The [guided-review record](../verification/guided-review-acceptance-2026-11-21.md) and [public release record](../releases/rtl-analyzer-0.3.0-publication-2026-11-20.md) remain historical evidence. This local package is not a new publication. Historical platform limitations and approval states remain unchanged.

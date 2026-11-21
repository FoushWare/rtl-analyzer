# Northstar WebKit acceptance

Verified on 2026-11-22 in Playwright WebKit 27.2, build 2370. Native Safari WebDriver declined the session because remote automation was disabled. No native Safari pass is claimed.

## Exact delivery

Public wrapper `rtl-analyzer@0.3.0`, wrapper build commit `d6e4c61343b53499a896aa15e33ff18d56b9dc84`, implementation pin `67c774823622f4ef8061f9fc5372978ad0e95022`, archive SHA-256 `ddad9d24c450baa1afbff7f1cb1843c7b4afa3cf68baae49465abb090a3a053d`. All 73 files in the archive were byte-identical to the active installation. No product implementation or packaged file changed during this check.

Evidence directory: `/Users/a.fouad/rtl-analyzer-dashboard-run/acceptance-repair/webkit-acceptance`.

| Check | Result |
|---|---|
| Live Northstar dashboard | Ten Original targets and eight candidate Afters verified in LTR and RTL. Tested actual RTL drawer closing motion, shadow, accent, corners, badge, flex order and mobile navigation. `browser-results.json` records findings, computed values, patches and candidate identities. |
| Drawer and mobile interaction | Sixteen drawer observations across Original and candidate, both directions and 390/1024 px. Open buttons, visible geometry, Escape, focus return and mobile Security link passed. See `app-interactions.json`. |
| Review one by one | Eight-candidate preview suite, five theme switches, theme and explicit approval persisted across reload / Resume. Accepted only the margin patch. Seven validation checks passed, one receipt, and all scanned hashes restored. |
| Prepare all, then review | Eight eligible patches prepared. Five theme switches, theme and explicit approval persisted across reload / Resume. Accepted only the accent patch. Seven validation checks passed, one receipt, and all scanned hashes restored. |
| Apply / rollback protection | In both WebKit-driven workflows, invalid confirmations left the source untouched. An added post-Apply source edit blocked rollback with `ROLLBACK_CONFLICT` and survived unchanged. Removing the injected drift allowed the UI rollback to restore all original hashes. See `workflows.json`. |
| Digest freshness | Exact installed proposal code generated the patch, blocked it after an unrelated CSS edit with `CSS_INTENT_STALE_SOURCE`, and generated it again after digest refresh. Changing the original value removed the intent match. See `stale-intent-results.json`. |

The dashboard actions ran in WebKit. The Companion's runtime verification still uses its shipped Playwright Chromium backend. Initial harness runs showed a request interruption around reload and an attempt to click through the review chooser. The final run explicitly resumed the saved review, rechecked the rendered frame, completed both transactions, and recorded no page errors or failed requests. No compatibility defect reproduced on the final run.

The [walkthrough](http://127.0.0.1:4320/rtl-report-dashboard.html) was restored to the actual Northstar project after the disposable run. It is running with zero accepted changes and no validation result. Ahmed's acceptance, his mobile navigation Tab-order decision, and release remain pending. The physical-right status marker intentionally has no patch.

See the [CSS proposal setup](../guides/css-proposal-setup.md), [project inventory](rtl-analyzer-project-inventory-2026-11-22.md), and [copyable Claude handoff](claude-handoff-2026-11-22.md).

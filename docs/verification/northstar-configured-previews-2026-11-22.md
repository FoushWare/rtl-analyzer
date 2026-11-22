# Northstar configured CSS proposals

The Northstar account fixture lives at `/Users/a.fouad/rtl-analyzer-dashboard-run/acceptance-repair/pending/project`. It uses the existing realistic account layout. The notification accents and actions, verified avatar badge, security indicator, outgoing support message, and account and device drawers now render in the application. The original stylesheet preserves the observed physical declarations. The internal manifest records the expected behavior in both directions. Drawer preview routes use a query parameter to open the corresponding component using the same function as its visible button.

## Configuration

An optional `cssProposals` array in `rtl-scanner.config.json` declares semantic input for assisted review. Records identify `path`, exact scanner `context`, `property`, `value`, `kind` and the lowercase SHA-256 `sourceDigest` of the stylesheet. The declaration needs `custom-css` ownership. The existing preview configuration supplies the exact rendered selector and both URLs. The policy has no authority to accept or apply a patch.

Supported intents are:

- `inline-edge` converts supported literal side borders and absolute/fixed insets to the corresponding logical edge of an LTR-authored rule.
- `logical-corners` converts four literal physical radii to logical longhands. Elliptical and dynamic values require a separate proposal.
- `dom-order` replaces `row-reverse` with `row` when a flex row should follow DOM order from reading start. An explicit mobile `order` or markup reorder is outside this converter.
- `mirror-offset` preserves the LTR literal and inverts the horizontal offset in RTL for one literal `translateX` or a single supported horizontal shadow. It leaves existing positioning and open-state selectors in place. Transforms that couple axes, multi-layer shadows and direction-dependent positioning need their own proposals.

The original digest and exact declaration anchor are checked before preparing a candidate. A stale digest requires reviewing the current rule and updating the project declaration. Source or target mismatches and unavailable runtime evidence fail preparation or validation. Candidate approval and source Apply use the existing workflow barriers. The scanner recognizes a complete literal offset pair and continues to flag the corresponding risk if either direction branch is absent.

The security indicator has an intentional physical-right anchor. Mobile navigation needs a product decision about tab order relative to the toolbar. If navigation must stay visually below it and match tab order, a proposal needs to include the corresponding HTML reorder and focused keyboard verification. The current manual implementation registration records edits already made. It does not stage arbitrary HTML/CSS edits into the isolated candidate.

## Installed package evidence

Verified 2026-11-22 with `rtl-analyzer@0.3.0` via the wrapper's normal npm prepack and isolated install. Wrapper commit `d6e4c61343b53499a896aa15e33ff18d56b9dc84` pins implementation `67c774823622f4ef8061f9fc5372978ad0e95022`. Tarball SHA-256 `ddad9d24c450baa1afbff7f1cb1843c7b4afa3cf68baae49465abb090a3a053d`.

Evidence directory: `/Users/a.fouad/rtl-analyzer-dashboard-run/acceptance-repair/northstar-preview`.

- `apply-rollback-results.json` records both modes on disposable copies of the actual Northstar fixture. Each mode accepted seven changes, passed configured project, scanner and runtime validation, produced one file receipt, and restored all scanned hashes exactly. A different supported proposal was left pending in each mode.
- `consumer-smoke.json` records the separate React/Vite consumer on `/people`. Its accent conversion passed in both workflows, including real opposite-side CSS in the candidate, explicit approval, revalidation against changed live data as a negative case, accepted-only Apply and exact rollback. A loaded rule whose configured target was absent returned zero targets and blocked approval.
- `independent-extra-results.json` records the Dispatch Desk Vite consumer on `/console`. This covers logical inset, logical corners, DOM-order flex direction and both mirrored offset properties using a different stylesheet and selectors. A rule with no configured binding remained blocked. The four accepted patches passed validation and the retained row reversal survived Apply. Rollback restored the stylesheet byte for byte.

The first full Northstar transaction exposed two generic blockers. A real mirrored offset still triggered the scan rule, so validation rejected it. After that was fixed, drawer startup transitions made the protected Apply recheck compare in-flight frames. Validation now samples after finite target and ancestor animations settle. The motion remains enabled in the live preview.

- `browser-results.json` verifies ten exact Original targets and eight real candidate Afters in LTR and RTL through the live dashboard. It contains the patch, candidate session and source hash per supported finding. Both drawer candidates moved toward the right in RTL during closing, while both originals moved toward the left. The mobile nav measurement was at the Mobile viewport, and the Security link navigated to its actual section.
- `app-interactions.json` records opening both drawers through the real buttons at 1024px and 390px in both directions, in both Original and candidate. Escape closes them and returns focus to the opener. The `screenshots/` directory contains the component and dashboard images.

Source typecheck and all 419 scanner tests passed. The installed walkthrough is at `http://127.0.0.1:4320/rtl-report-dashboard.html`, with approval still pending. Release and handoff are pending.

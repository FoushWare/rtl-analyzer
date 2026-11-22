# Admin dashboard (example project 3)

React + Vite + CSS Modules orders dashboard (tables, a details dialog, tabs). This is a small first slice of the matrix scope TABLES / OVERLAYS / ACCESSIBILITY-006 (see `manifest.json`; many catalogue IDs are deferred). Expectations in the manifest were recorded before the first scan.

| ID | Target | Expected |
|---|---|---|
| ATD-FIX-01 | `.statusBadge` `margin-left` | supported candidate `margin-inline-start` |
| ATD-FIX-02 | `.dialogTitle` `margin-right` (dialog route `?dialog=details`) | supported candidate `margin-inline-end` (needs the margin reset isolated in a separate rule; see below) |
| ATD-REVIEW-01 | `.stickyId` `left: 0` (sticky) | finding, no candidate, manual review |
| ATD-REVIEW-02 | `.amountCell` `text-align: right` | finding; manual review (ownership/intent); computed alignment is `right` |
| ATD-OK-01 | `.orders th/td`, `.tableScroll` | no finding |
| ATD-OK-02 | `.tabs`, `.tab`, `.toolbar` | no finding |
| ATD-SUSPECT-01 | `.dialog` `box-shadow: 0 12px 32px #0004` | `RTL.GEOMETRY.ORDER`, manual, not actionable: **suspected scanner false positive** (zero horizontal offset) |

`RTL.DOCUMENT.INITIAL` and `RTL.RUNTIME.DIRECTION_UNKNOWN` (`App.jsx`) are diagnostics, not case results.

## Run

```sh
npm install
npm run build
npm run dev        # http://127.0.0.1:4235/?direction=rtl  (dialog: &dialog=details)
```

## Scan and review (disposable copy)

Use a built `rtl-analyzer` package (see [Reproduce](../../docs/handoffs/claude/REPRODUCE.md)) installed from a tarball; this example was verified with `rtl-analyzer@0.3.0` built from implementation `54648af`. Set `PACK` to that tarball and run from the repository root:

```sh
run=$(mktemp -d /private/tmp/rtl-admin.XXXXXX)
mkdir -p "$run/reports" "$run/state/backups"
cp -R examples/admin-dashboard "$run/project"
cd "$run/project"
npm install && npm run build && rm -rf dist
npm install --no-save --package-lock=false "$PACK"
npx --no-install playwright install chromium
npx --no-install rtl-analyzer scan --root "$PWD" --format dashboard \
  --output-dir "$run/reports" --embed-source-snippets
```

Start the Companion and dashboard (separate terminals; ports 4318 and 4320 are fixed by the Analyzer and must be free):

```sh
cd "$run/project"
export RTL_PROJECT_ROOT="$PWD" RTL_REVIEW_STORE_PATH="$run/state/review-records-v1.json" \
  RTL_EVIDENCE_STORE_PATH="$run/state/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="$run/state/manual-changes-v1.json" \
  RTL_SCAN_MANIFEST_STORE_PATH="$run/state/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="$run/state/apply-audit-v1.json" \
  RTL_APPLY_BACKUP_ROOT="$run/state/backups"
npx --no-install rtl-analyzer preview
```

```sh
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$run/reports"
```

Open `http://127.0.0.1:4320/rtl-report-dashboard.html`, choose **Review one by one**, and use Next finding. Leave decisions pending. The Original app is served on `:4236`, candidates on `:4202`. The Analyzer writes `.rtl-preview/` and `.rtl-vite-cache/` in the project copy (gitignored here).

## Verified behavior (one local run, 2026-11-22)

- Scan: 5 actionable findings plus 2 diagnostics (`RTL.DOCUMENT.INITIAL`, `RTL.RUNTIME.DIRECTION_UNKNOWN` in `App.jsx`). Both clean controls produced no finding. Project source hashes were identical before and after review.
- `.statusBadge`: all three rows are intended targets; After shows "All 3 targets". RTL gap Original 0 px, After 8 px. The first After preview of every cold session failed with `Execution context was destroyed`; the Account Checkout troubleshooting workaround (open the candidate URL, then Retry preview) fixed it each time. `DIRECTION_EVIDENCE_AMBIGUOUS_TARGETS` appeared once in the first session and did not recur.
- `.dialogTitle`: with `margin: 0` in the same rule, or `margin-block: 0` next to `margin-right`, the Analyzer reported manual review (`CSS_SPACING_CASCADE_DECLARATION_CONFLICT`). With the reset moved to `:where(.dialogHeader) > :where(h2) { margin: 0 }`, it offers `margin-inline-end: 24px` with a live After.
- `.amountCell`: the table-cell rule uses `:where()` so `.amountCell` wins; computed alignment is `right`, amounts sit flush to the cell's right edge in LTR and RTL, and After says manual review (`CSS_DIRECTIONAL_OWNER_REQUIRES_REVIEW`).
- `.stickyId`: manual review with `CSS_DIRECTIONAL_OWNER_REQUIRES_REVIEW`; Original renders in both directions. Not verified while scrolled horizontally.
- Not exercised: Approve, Validate, Apply and rollback; human acceptance is pending.

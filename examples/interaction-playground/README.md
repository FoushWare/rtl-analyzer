# Interaction playground (example project 5)

React 19 + TypeScript + Vite + CSS Modules. A small slice of the matrix scope INTERACTION (INTERACTION-002, -006, -010) and ACCESSIBILITY-004/-006, using the `en-ltr` and `ar-rtl` variants with keyboard input on a desktop viewport. Selected and deferred IDs are in `manifest.json`. Expected keyboard behavior, focus order and Analyzer outcomes were written to `manifest.json` **before the first scan**.

**Headline.** Browser behavior, scanner findings and live previews are three different things here:

- **Browser:** the app has real RTL keyboard defects (drawer edge, rating, custom slider, tab list). Two of them (arrow-key direction in tabs and rating) are JavaScript behavior.
- **Scanner:** finds the CSS risks (7 manual findings) and, as expected, **does not see the JavaScript key handlers**. It offered **no supported candidate** for any case.
- **Preview:** a dynamic inline style (even a custom property) makes the scan incomplete, which blocks every live Original with `CONTEXT_SCAN_INCOMPLETE`. After was manual-only for all findings, so no After was verified.

## Run

```sh
npm install
npm run dev        # http://127.0.0.1:4255/?direction=ltr  (Arabic: ?direction=rtl, drawer: &drawer=open)
npm run check      # tsc --noEmit + vite build
```

The language link is a plain `<a>` (full reload), so `<html dir lang>` is set from `?direction=`.

## Cases and expectations (recorded before the first scan)

| ID | Catalogue | Target | Expected browser behavior | Expected Analyzer outcome |
|---|---|---|---|---|
| IPG-FIX-01 | INTERACTION-010 | `.drawer` `left: 0` + `translateX(-100%)` | LTR opens from the left; RTL should open from the right but still opens from the left. Focus move, Tab trap and Escape work in both | edge and transform findings, manual |
| IPG-FIX-02 | INTERACTION-006 | `.star + .star` `margin-left: 6px`; `Rating.tsx` keys | RTL: 0 px gap; ArrowRight moves focus visually left | `RTL.CSS.PHYSICAL`; candidate uncertain; key handler not detectable |
| IPG-REVIEW-01 | INTERACTION-002 | `.sliderFill` / `.sliderThumb` physical `left`; `Slider.tsx` keys | RTL: track still starts at the left; ArrowRight increases | edge finding(s), manual |
| IPG-KEY-01 | ACCESSIBILITY-004/-006 | `Tabs.tsx` keys (CSS is logical) | RTL: ArrowRight moves focus visually left | **no finding** (JS behavior, expected miss) |
| IPG-OK-01 | ACCESSIBILITY-004 | `Toolbar.tsx` (direction-aware keys, logical CSS), native `<input type=range>` | correct in both directions | no finding |

Expected focus order (DOM order in both directions; header flex mirrors, roving tabindex gives one stop per widget): Open menu, Language link, active tab, active star, custom slider, active toolbar button, native range. Closed drawer is `inert`. Open drawer: focus to the first link, Tab cycles link, link, link, Close and wraps, Escape closes and returns focus to Open menu.

## Reproduce

Needs Node 22.12+, npm, Python 3. From the wrapper root, build the Analyzer tarball (the pin is `54648af`):

```sh
git submodule status implementation        # expect 54648af70b4a2439da64fcfa654745cdf51de08b
npm ci && npm --prefix implementation ci   # once
mkdir -p /private/tmp/rtl-ip-pack
npm pack --pack-destination /private/tmp/rtl-ip-pack ./packages/rtl-analyzer
shasum -a 256 /private/tmp/rtl-ip-pack/rtl-analyzer-0.3.0.tgz
tar -xOzf /private/tmp/rtl-ip-pack/rtl-analyzer-0.3.0.tgz package/package.json | grep '"commit"'
```

Verified run: sha256 `94d001988755f06297d7a52088484fd441875035767238b8846b4336ffb0b07a`, commit `54648af70b4a2439da64fcfa654745cdf51de08b` (a rebuild can give another hash; check the `commit` line).

Scan a fresh disposable copy (never the checked-in example):

```sh
PACK=/private/tmp/rtl-ip-pack/rtl-analyzer-0.3.0.tgz
run=$(mktemp -d /private/tmp/rtl-interaction.XXXXXX)
mkdir -p "$run/reports" "$run/state/backups"
rsync -a --exclude node_modules --exclude dist examples/interaction-playground/ "$run/project/"
cd "$run/project"
npm ci && npm run check && rm -rf dist
npm install --no-save --package-lock=false "$PACK"
npx --no-install playwright install chromium
find . \( -path ./node_modules -o -path ./dist -o -path ./.rtl-preview -o -path ./.rtl-vite-cache \) -prune -o -type f -print | sort | xargs shasum -a 256 > "$run/hashes-before.txt"
npx --no-install rtl-analyzer scan --root "$PWD" --format dashboard --output-dir "$run/reports" --embed-source-snippets
```

Browser checks of the app itself (stop it before the Analyzer; the Companion uses `:4256`):

```sh
cd "$run/project" && npm run dev     # :4255; Tab through the page, use ArrowLeft/ArrowRight on each widget, open the drawer with Enter, Escape closes
```

Companion and dashboard (separate terminals; ports 4318 and 4320 must be free):

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

Open `http://127.0.0.1:4320/rtl-report-dashboard.html`, choose **Review one by one**, **Start manual review**, and step with Next finding. Leave every decision pending. Afterwards re-run the `find … > "$run/hashes-after.txt"` line and `diff` the two lists.

## Results (one local run, 2026-11-22)

### 1. Browser behavior (built-in Browser pane, Chromium, 1024 px, real key events)

Not scanner output. Focus order matched the recorded expectation in LTR and RTL.

| Check | LTR | RTL | Intended |
|---|---|---|---|
| Drawer edge (IPG-FIX-01) | x 0 to 292 (left) | **x 0 to 292, still left** | RTL: right edge; **defect shown** |
| Drawer keyboard | focus to first link, Tab cycles 4 stops, Shift+Tab reverses, Escape closes and returns focus | same | ok |
| Star gap (IPG-FIX-02) | 6 px | **0 px** | **defect shown** |
| Rating ArrowRight, 3 to 4 | focus moves visually right | **moves visually left** (x 862 to 824) | ArrowLeft should increase in RTL; **defect shown** |
| Custom slider (IPG-REVIEW-01) | fill from the left, ArrowRight 30 to 40 | **fill and thumb still from the left**, ArrowRight increases | track should start at the right; **defect shown** |
| Tab list ArrowRight (IPG-KEY-01) | Overview to Billing, visually right | **Overview (x 871) to Billing (x 796), visually left** | ArrowLeft should be next; **defect shown** |
| Toolbar (IPG-OK-01) | ArrowRight moves visually right | ArrowLeft from the first (rightmost) button goes to the middle one (x 895 to 825); ArrowRight wraps | ok |
| Native range (IPG-OK-01) | ArrowRight 30 to 31 | ArrowRight 30 to 29, ArrowLeft increases | browser mirrors the key direction; ok (my prediction was right) |

### 2. Scanner findings (`rtl-analyzer@0.3.0`, implementation `54648af`)

Final scan (third attempt, see below): 10 files, `complete: true`, **7 actionable findings, all manual review, no supported candidate**, plus `RTL.DOCUMENT.INITIAL` and `RTL.RUNTIME.DIRECTION_UNKNOWN` (`App.tsx`) diagnostics-class entries.

| Finding | Case | Reason code (Fix Studio) |
|---|---|---|
| `RTL.GEOMETRY.EDGE` `.drawer` `left: 0` (css:11) | IPG-FIX-01 | `CSS_DIRECTIONAL_OWNER_REQUIRES_REVIEW` |
| `RTL.GEOMETRY.ORDER` `.drawer` `transform: translateX(-100%)` (css:11) | IPG-FIX-01 | `UNSUPPORTED_TRANSFORMATION_FAMILY` |
| `RTL.GEOMETRY.ORDER` `.drawer` `box-shadow: 0 0 24px` (css:11) | none | **suspected false positive**: zero horizontal offset, same pattern as admin-dashboard ATD-SUSPECT-01 |
| `RTL.CSS.PHYSICAL` `.star + .star` `margin-left` (css:19) | IPG-FIX-02 | `CSS_SPACING_SIMPLE_CLASS_SELECTOR_REQUIRED`; an owner override did not change it |
| `RTL.GEOMETRY.EDGE` `.sliderFill` `left: 0` (css:25) | IPG-REVIEW-01 | `CSS_DIRECTIONAL_OWNER_REQUIRES_REVIEW` |
| `RTL.GEOMETRY.EDGE` `.sliderThumb` `left: var(--value)` (css:26) | IPG-REVIEW-01 | `CSS_DIRECTIONAL_OWNER_REQUIRES_REVIEW` |
| `RTL.CSS.PHYSICAL` `.sliderThumb` `margin-left: -12px` (css:26) | IPG-REVIEW-01 | `CSS_SPACING_OWNER_REQUIRES_REVIEW` |
| none | IPG-KEY-01, key handlers of IPG-FIX-02 / IPG-REVIEW-01 | expected miss (JavaScript behavior) |
| none | IPG-OK-01 | clean control confirmed |

Attempt history (each rescan's expectations were written to `manifest.json` first):

1. **First scan:** `Slider.tsx` set `width` and `left` through an inline style. Result: `complete: false`, two blocking `DYNAMIC_VALUE` diagnostics, an extra `RTL.GEOMETRY.EDGE` on the inline `left`, and every Original failed with `CONTEXT_SCAN_INCOMPLETE`.
2. **Custom property:** `style={{'--value': …}}`. Still `complete: false` (`DYNAMIC_VALUE` for `--value`).
3. **Imperative:** `ref.style.setProperty('--value', …)` in a layout effect, so JSX has no inline style expression. Result: `complete: true`. This is the checked-in source. The fixture workaround is documented, not hidden; the Analyzer was not changed.

### 3. Live previews (Fix Studio, Review one by one)

- Original rendered for all 7 findings in the final scan; the RTL toggle was checked on the `.star + .star` finding (RTL Original shows the app, "Verified targets: 4"). For the `.drawer` findings the Original lists target "Open menu"; I did not inspect which element was highlighted or whether the `drawer-open` route was used.
- After: "Preview unavailable", "Manual review required · No supported candidate preview" for all 7. **No After was verified**, because no candidate exists.
- Approve is disabled for every finding ("approval unavailable").

### 4. Review state and hashes

All 7 decisions remain **pending**; no review record was written (the state directory contains only `backups/`). The disposable copy's 19 files (excluding `node_modules`, `dist`, `.rtl-preview`, `.rtl-vite-cache`) had identical SHA-256 lists before the scan and after review (hash-of-list `990734f5348979e1c6ce1d7eed19a76e39677acf2dc5c17e72376b9436d28578`), and the copy's `src/` matched the checked-in example. The first scan copy (reviewed only partly, one finding opened) was also checked afterwards: identical. The second copy was scanned only. `manifest.json` and this README were edited after the scans (not part of the scan roots).

## Gaps

- No candidate or After exists for any case; Approve, Validate, Apply and rollback were not exercised; human acceptance pending.
- The scanner cannot see JavaScript key handling (IPG-KEY-01 and the rating/slider handlers). Browser verification is the only evidence for those.
- A single dynamic inline style value makes the whole scan incomplete and blocks every live Original (reported, not fixed).
- `.star + .star` is rejected as a non-simple selector even with an owner override.
- Suspected `box-shadow` false positive reproduced again (`RTL.GEOMETRY.ORDER`, zero horizontal offset).
- Chromium only (Safari and Firefox untested); desktop width only; no touch, narrow viewport, reduced-motion or screen-reader checks; the drawer target identity in Fix Studio was not inspected.
- Deferred catalogue IDs: INTERACTION-001, -003..-005, -007..-009, -011, -012 and ACCESSIBILITY-001..-003, -005, -007..-009.

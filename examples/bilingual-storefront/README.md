# Bilingual storefront (example project 4)

Next.js 15 (App Router) + TypeScript + Tailwind 3 storefront in English (LTR) and Arabic (RTL). A small slice of the matrix scope NAVIGATION / ICONS (selected and deferred IDs are in `manifest.json`). It has one direction-following icon (the "next" arrow), several direction-neutral controls, a bilingual header, breadcrumb, pagination and a mobile drawer. Expectations were written to `manifest.json` and the table below **before the first scan**.

**Headline result:** the static scan works and finds what we expected (plus one extra finding), but **Analyzer 0.3.0 cannot run its live Original/After preview for Next.js**. Every Original and After pane failed, so no After was verified visually. See [Preview failure](#preview-failure-nextjs).

## Run

```sh
npm install
npm run dev        # http://127.0.0.1:4245/?lang=en  (Arabic: ?lang=ar)
npm run build && npm run check
```

Routes: `/?lang=en|ar`, `&drawer=open` (mobile menu drawer, visible at any width once opened; the Menu button shows below 768 px), `&page=1|2`. The language link is a plain `<a>` on purpose: a client-side `<Link>` navigation keeps the root layout, so `<html dir>` would stay stale (this was a real bug found in browser verification and fixed before the final scan).

## Cases and expectations (recorded before the first scan)

| ID | Catalogue | Target | LTR / intended RTL | Expected Analyzer outcome |
|---|---|---|---|---|
| SBF-FIX-01 | NAVIGATION-012/001 | `.cart-count` `margin-left: 6px` | badge trails the Cart label with a gap | `RTL.CSS.PHYSICAL`; candidate `margin-inline-start` (**uncertain**: no prior Next.js evidence) |
| SBF-FIX-02 | NAVIGATION-005, ICONS-002 | `.pager-arrow` `margin-left: 8px` | gap between "Next" and its arrow | as above |
| SBF-ICON-01 | ICONS-002/003 | `.icon-forward`, marked `/* rtl-icon: progression-right */` | arrow means "next": must point left in RTL | `RTL.ICON.PROGRESSION`; candidate `:dir(rtl){scale:-1 1}` (**uncertain**, many gating conditions) |
| SBF-REVIEW-01 | NAVIGATION-003 | `.drawer` `left: 0` | should open from the start edge (right in RTL) | finding, manual (**uncertain** whether a candidate is offered) |
| SBF-TW-01 | NAVIGATION-001 | `ml-6` on two nav links | gap on the start side | finding; no candidate expected (**uncertain** classification) |
| SBF-TW-02 | ICONS-004 | `text-left` on the product blurb | blurb aligns to start | finding; manual (**uncertain** classification) |
| SBF-MISS-01 | ICONS-001 | `.icon-back`, no marker | Previous arrow should point right in RTL | **no finding** (marker opt-in; expected miss) |
| SBF-OK-01 | NAVIGATION-004 | breadcrumb with `ps-`, `gap-`, `text-start`, `end-4` | correct | no finding |
| SBF-OK-02 | ICONS-008 | search and plus icons (direction-neutral) | never mirrored | no finding; must not be mirrored |
| SBF-OK-03 | ICONS-007 | down chevrons | stay down | no finding |

Preview was also **uncertain** before the scan: `rtl-preview.config.json` declares the Next dev server through the Vite-shaped fields (`viteConfig: next.config.mjs`) because the documented adapter is Vite-compatible only.

## Reproduce

Needs Node 22.12+, npm, Python 3. Build the Analyzer tarball from the wrapper root (the pinned implementation is `54648af`):

```sh
git submodule status implementation        # expect 54648af70b4a2439da64fcfa654745cdf51de08b
npm ci && npm --prefix implementation ci   # once
mkdir -p /private/tmp/rtl-sf-pack
npm pack --pack-destination /private/tmp/rtl-sf-pack ./packages/rtl-analyzer
shasum -a 256 /private/tmp/rtl-sf-pack/rtl-analyzer-0.3.0.tgz
tar -xOzf /private/tmp/rtl-sf-pack/rtl-analyzer-0.3.0.tgz package/package.json | grep '"commit"'
```

Verified run: sha256 `94d001988755f06297d7a52088484fd441875035767238b8846b4336ffb0b07a`, commit `54648af70b4a2439da64fcfa654745cdf51de08b`. A rebuild can give another archive hash; check the `commit` line. (An older `/private/tmp/rtl-wrapper-pack.*` archive on this Mac is pinned to `67c7748`; do not use it.)

Scan a fresh disposable copy (never the checked-in example):

```sh
PACK=/private/tmp/rtl-sf-pack/rtl-analyzer-0.3.0.tgz
run=$(mktemp -d /private/tmp/rtl-storefront.XXXXXX)
mkdir -p "$run/reports" "$run/state/backups"
rsync -a --exclude node_modules --exclude .next --exclude next-env.d.ts --exclude '*.tsbuildinfo' examples/bilingual-storefront/ "$run/project/"
cd "$run/project"
npm ci && npm run build && rm -rf .next next-env.d.ts tsconfig.tsbuildinfo
npm install --no-save --package-lock=false "$PACK"
npx --no-install playwright install chromium
find . \( -path ./node_modules -o -path ./.next -o -path ./.rtl-preview -o -path ./.rtl-vite-cache \) -prune -o -type f ! -name next-env.d.ts ! -name '*.tsbuildinfo' -print | sort | xargs shasum -a 256 > "$run/hashes-before.txt"
npx --no-install rtl-analyzer scan --root "$PWD" --format dashboard --output-dir "$run/reports" --embed-source-snippets
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

Open `http://127.0.0.1:4320/rtl-report-dashboard.html`, choose **Review one by one**, **Start manual review**, and step through the four files. Leave every decision pending. The live app for direct browser checks is `npm run dev` in the disposable copy (`:4245`); stop it before using the Analyzer.

After review, re-run the `find … > "$run/hashes-after.txt"` line and `diff` the two files.

## Expected versus actual

Scan: 13 files, **8 findings, 0 diagnostics** (`RTL.DOCUMENT.INITIAL` / `DIRECTION_UNKNOWN` were possible and did not appear). The same 8 findings appeared on two fresh copies (first scan, then again after the language-link fix).

| ID | Actual finding(s) | Verdict |
|---|---|---|
| SBF-FIX-01 | `RTL.CSS.PHYSICAL` `storefront.css:5`; supported candidate `margin-inline-start: 6px` | as expected (code diff); preview failed |
| SBF-FIX-02 | `RTL.CSS.PHYSICAL` `storefront.css:17`; supported candidate `margin-inline-start: 8px` | as expected (code diff); preview failed |
| SBF-ICON-01 | `RTL.ICON.PROGRESSION` `icons.css:5`; **no candidate**: manual, `CSS_ICON_OWNER_OR_INTENT_REVIEW`. Finding ownership is `unknown` although `rtl-scanner.config.json` has an owner override for `.icon-forward` | detection as expected; uncertain candidate did **not** appear (cause not investigated) |
| SBF-REVIEW-01 | `RTL.GEOMETRY.EDGE` `storefront.css:26`; manual, `CSS_DIRECTIONAL_OWNER_REQUIRES_REVIEW` | as expected |
| SBF-TW-01 | 2 x `RTL.UTILITY.PHYSICAL` `Header.tsx:17,18` (`ml-6`); manual, `UTILITY_COMPILER_VERSION_AND_VARIANT_REVIEW_REQUIRED` | as expected |
| SBF-TW-02 | `RTL.UTILITY.PHYSICAL` `ProductCard.tsx:11` (`text-left`); manual | as expected |
| SBF-MISS-01 | none | expected miss confirmed |
| SBF-OK-01/02/03 | none | as expected |
| *(unexpected)* | `RTL.BIDI.ISOLATION` `ProductCard.tsx:8` `{product.name}`; supported candidate `<bdi dir="auto">{product.name}</bdi>`, no preview binding | not in expectations; not judged a false positive (dynamic name, no `bdi`/`dir` ancestor) |

Missed findings relative to the intended defects: the **Previous arrow** (SBF-MISS-01, by design: no marker) and, in practice, the **mirroring candidate for the marked Next arrow** (SBF-ICON-01). No clear false positives.

### Preview failure (Next.js)

Observed on every finding that has a preview binding (`.cart-count`, `.pager-arrow`, `.drawer`, `.icon-forward`): Original shows `Runtime unavailable … ORIGINAL_PREVIEW_STARTUP_FAILED`; After shows `Preview preparation failed` (supported candidates) or `Preview unavailable` (manual). **Retry preview** failed the same way. Findings with no binding (`ml-6`, `text-left`, `{product.name}`) say "no exact source-to-element binding". Cause, reproduced by hand in the disposable copy: the Analyzer runs `npm run dev -- --config <vite config> --host 127.0.0.1 --port N --strictPort`, which Next.js rejects with `error: unknown option '--config'`, and it needs a Vite-served `/__rtl_preview_identity` endpoint. Next.js is therefore **not supported by the 0.3.0 live preview**. The Analyzer was not changed. The scan, candidate code diffs and manual reasons work.

**Setup workaround:** none found within scope (a Vite harness would no longer be this Next.js app). Original behaviour was verified directly against the running app instead (next section). The only fixture workaround was the plain-anchor language link described under Run.

## Browser verification of the app (built-in Browser pane, 1024 px wide unless stated)

| Check | LTR (`?lang=en`) | RTL (`?lang=ar`) | Intended |
|---|---|---|---|
| `<html lang dir>` after clicking the language link | `en` / `ltr` | `ar` / `rtl` | ok |
| Nav order (Home, Products, Account) | left to right | right to left | ok |
| `ml-6` nav gap (SBF-TW-01) | gap after Home | Home and Products touch; gap on the wrong side | **defect shown** |
| Cart badge vs label (SBF-FIX-01) | 6 px gap | 0 px (badge touches label) | **defect shown** |
| Pager order | Previous 1 2 Next | Next 2 1 Previous (mirrored order) | ok |
| Next arrow gap (SBF-FIX-02) | 8 px | 0 px | **defect shown** |
| Forward arrows (6: breadcrumb x2, card CTA x3, Next) | point right | **still point right** (no transform) | should point left; **defect shown** |
| Previous arrow (SBF-MISS-01) | points left | **still points left** | should point right; **defect shown** |
| Search, plus, down chevrons | unchanged | unchanged, not mirrored | ok (controls) |
| Product blurb alignment (SBF-TW-02) | `left` | **`left`** while text is Arabic | should be `right`; **defect shown** |
| Drawer at 390 px (SBF-REVIEW-01) | x 0 to 256 | x 0 to 256 (left edge) | should be the right edge; **defect shown** |

The fixed plus button (`end-4`) was not visually confirmed: the Next.js dev indicator sat over it at the bottom corner. After-state behaviour of the proposed fixes was **not** verified because the preview cannot run.

## Review state and hashes

Review One by One was opened on the final copy and all four files and all 8 findings were opened; no Approve/Reject/Defer/Needs review was chosen, so **all 8 decisions remain pending for Ahmed**; no review record was written. The disposable copy's 24 source files (excluding `node_modules`, `.next`, `.rtl-preview`, `.rtl-vite-cache`, `next-env.d.ts`, `*.tsbuildinfo`) had **identical SHA-256 lists before the scan and after review** (hash-of-list `8c0f3f8c1af25608b33362c580eca30ea75a9ba8111ccc933805e68382a35c3d`). At scan time the disposable copy's source files matched the example's (`manifest.json` and this README were edited afterwards and are not in the scan roots). Not exercised: Approve, Validate, Apply, rollback, "Prepare all, then review", Safari, Windows, human acceptance.

Scan roots: `app/`, `components/`, `lib/`, `middleware.ts`. `npm run check` (`tsc --noEmit`) and `npm run build` passed on the fixed source. `npm install` reports audit advisories for the pinned Next version (not addressed here).

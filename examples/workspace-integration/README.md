# Workspace integration (example project 6)

A small Nx workspace: two React + Vite apps (`storefront`, `admin`) and one shared UI library (`libs/ui`, imported as `@ws/ui` through a Vite alias and tsconfig `paths`). Nx 23.3.0 is used for orchestration only (`nx:run-commands` targets, no Nx Vite plugin). The project matrix (`docs/rtl-analyzer-v3/rtl-ui-catalog.json`) defines no workspace cases, so this slice reuses **LAYOUT-001 (margin)**; the workspace shape and the shared / app-specific / control split are this project's own. Expectations were written to `manifest.json` **before the first install, build or scan**.

**Headline.**

- **Scanner:** finds the shared-library defect once, under `libs/ui/...`, and the admin-only defect under `apps/admin/...`. The shared finding has `applications: []` (no app attribution); the admin one has `["admin"]`.
- **Browser:** both apps show the shared badge defect in RTL (0 px gap); only admin shows the app-specific one.
- **Fix Studio:** Nx startup worked. The shared-library finding previews in **both** apps (app selector) and After closes the RTL gap in both. One first-time candidate preparation failed with a navigation error and succeeded on Retry.

## Cases and expectations (recorded before the first scan)

| ID | Rendered by | Target | Expected LTR / RTL | Expected Analyzer |
|---|---|---|---|---|
| WSI-SHARED-01 | storefront `#product`, admin `#order` | `libs/ui/src/StatusBadge.module.css` `.badge { margin-left: 8px }` | gap 8 px / **0 px (defect)** in both apps | 1 `RTL.CSS.PHYSICAL` finding under `libs/`; candidate `margin-inline-start: 8px`; previews in both apps |
| WSI-APP-01 | admin `#refund` only | `apps/admin/src/Admin.module.css` `.refundNote { margin-left: 12px }` | gap 12 px / **0 px (defect)** | 1 finding under `apps/admin`; candidate `margin-inline-start: 12px`; preview in admin only |
| WSI-OK-01 | both (`InfoCard`), storefront `.promo` | logical-only CSS in `InfoCard.module.css`, `Storefront.module.css`, rest of `Admin.module.css` | accent border on the start side in both directions | no findings |

Expected total: 2 actionable findings, plus `RTL.DOCUMENT.INITIAL` and `RTL.RUNTIME.DIRECTION_UNKNOWN` per app (diagnostic-class).

## Run

```sh
npm install
npm run check                # tsc --noEmit + nx run-many -t build (both apps)
npm run dev:storefront       # http://127.0.0.1:4265/?direction=rtl  (Arabic: rtl, English: ltr)
npm run dev:admin            # http://127.0.0.1:4275/?direction=rtl
```

`rtl-preview.config.json` declares one application per app with `startupScript` `dev:storefront` / `dev:admin`, preview origins 4266 / 4276, and two mappings: the shared `.badge` bound to the `home` route of **both** apps, and the admin `.refundNote` bound to admin only.

## Reproduce (disposable copy; never scan the checked-in example)

Needs Node 22.12+, npm, Python 3. From the wrapper root (the pin is `54648af`):

```sh
git submodule status implementation        # expect 54648af70b4a2439da64fcfa654745cdf51de08b
npm ci && npm --prefix implementation ci   # once
mkdir -p /private/tmp/rtl-ws-pack
npm pack --pack-destination /private/tmp/rtl-ws-pack ./packages/rtl-analyzer
shasum -a 256 /private/tmp/rtl-ws-pack/rtl-analyzer-0.3.0.tgz
tar -xOzf /private/tmp/rtl-ws-pack/rtl-analyzer-0.3.0.tgz package/package.json | grep '"commit"'
```

Verified run: sha256 `94d001988755f06297d7a52088484fd441875035767238b8846b4336ffb0b07a`, commit `54648af70b4a2439da64fcfa654745cdf51de08b` (same archive as project 5).

```sh
PACK=/private/tmp/rtl-ws-pack/rtl-analyzer-0.3.0.tgz
run=$(mktemp -d /private/tmp/rtl-workspace.XXXXXX)
mkdir -p "$run/reports" "$run/state/backups"
rsync -a --exclude node_modules --exclude dist --exclude .nx examples/workspace-integration/ "$run/project/"
cd "$run/project"
npm ci && npm run check && rm -rf dist .nx
npm install --no-save --package-lock=false "$PACK"
npx --no-install playwright install chromium
find . \( -path ./node_modules -o -path ./dist -o -path ./.nx -o -path ./.rtl-preview -o -path ./.rtl-vite-cache \) -prune -o -type f -print | sort | xargs shasum -a 256 > "$run/hashes-before.txt"
npx --no-install rtl-analyzer scan --root "$PWD" --format dashboard --output-dir "$run/reports" --embed-source-snippets > /dev/null
```

Redirect the scan's stdout; the dashboard format prints the HTML. Direct browser checks: run the two `npm run dev:*` scripts in the copy and stop them before starting the Companion (it uses 4266 / 4276 for originals and 4202+ for candidates).

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

Open `http://127.0.0.1:4320/rtl-report-dashboard.html`, choose **Review one by one**, **Start manual review**, step with **Continue to next file**, and leave every decision pending. Stop the Companion with Ctrl-C, then re-run the `find ... > "$run/hashes-after.txt"` line and `diff` the lists. Stop leftover `nx` daemon processes of the copy (`npx nx daemon --stop`); one survived the Companion's shutdown each time.

## Results (one local run, 2026-11-22)

### Attempt history (each rescan's expectations were written first)

1. **Scan 1:** matched the recorded findings. The browser check showed my WSI-APP-01 expectation was wrong: with `margin-right: 12px` on the trailing note the LTR gap was 0 px and RTL 12 px, the reverse of the recorded behavior. Fixture error, not an Analyzer result. Changed to `margin-left: 12px`.
2. **Scan 2:** same findings. Fix Studio offered **no candidate** for either (`CSS_SPACING_OWNER_REQUIRES_REVIEW`) because I had not declared owners. My expectation of candidates was also wrong; projects 3 and 5 declare `ownerOverrides`. Both Originals rendered (hashes identical).
3. **Scan 3 (final):** `ownerOverrides` (`custom-css`) for `.badge` and `.refundNote` added to `rtl-scanner.config.json`. All results below are from this run.

### 1. Scanner (`rtl-analyzer@0.3.0`, implementation `54648af`)

`complete: true`; 15 files scanned; skipped by design: `project.json` x3, `vite.config.mjs` x2. 6 findings:

| Finding | Path | Line | `applications` |
|---|---|---|---|
| `RTL.CSS.PHYSICAL` `margin-left: 8px;` (shared `.badge`) | `libs/ui/src/StatusBadge.module.css` | 3 | **`[]`** |
| `RTL.CSS.PHYSICAL` `margin-left: 12px;` (`.refundNote`) | `apps/admin/src/Admin.module.css` | 7 | `["admin"]` |
| `RTL.DOCUMENT.INITIAL` | `apps/admin/index.html`, `apps/storefront/index.html` | 2 | one app each |
| `RTL.RUNTIME.DIRECTION_UNKNOWN` | `apps/admin/src/App.tsx`, `apps/storefront/src/App.tsx` | 13 | one app each |

No findings in `InfoCard.module.css`, `Storefront.module.css` or the rest of `Admin.module.css`: WSI-OK-01 clean. Paths are workspace-relative and the shared file appears once, under `libs/`.

### 2. Direct browser behavior (built-in Browser pane, Chromium; apps started with `npm run dev:*` through Nx; computed styles and rects)

| Case | App | LTR | RTL |
|---|---|---|---|
| WSI-SHARED-01 badge gap | storefront | 8 px (ml 8, mr 0) | **0 px** (ml 8, mr 0): defect |
| WSI-SHARED-01 badge gap | admin | 8 px | **0 px**: defect |
| WSI-APP-01 note gap | admin | 12 px | **0 px** (after the fixture fix; measured in the Fix Studio Original) |
| WSI-OK-01 card border | both | 4 px left | 4 px right: ok |
| WSI-OK-01 storefront promo border | storefront | 3 px left | 3 px right: ok |

Both apps set `<html dir lang>` from `?direction=` (`en`, `ar`). The WSI-APP-01 LTR/RTL gaps measured on the first fixture were 0 / 12 px (wrong expectation, see attempt 1).

### 3. Fix Studio previews (Review one by one, final scan)

| Finding | After | Original origin to After origin | RTL gap before to after | LTR after |
|---|---|---|---|---|
| admin `.refundNote` | `margin-inline-start: 12px`, Preview ready, Pending approval | 4276 to 4202 | 0 to **12 px** | 12 px |
| shared `.badge`, storefront | `margin-inline-start: 8px`, Preview ready (after Retry) | 4266 to 4203 | 0 to **8 px** | 8 px |
| shared `.badge`, admin | same | 4276 to 4202 | 0 to **8 px** | 8 px |

- **Preview targets:** the shared finding offers both apps (selector `storefront · /` / `admin · /`), 1 verified target each. The admin-only finding offers only admin.
- **Nx startup:** worked. The Companion ran `npm run dev:<app> -- --config .rtl-preview/vite.<app>.config.mts --host 127.0.0.1 --port 4266|4276 --strictPort`, which Nx expanded onto the command in `project.json`. Because that command already hardcodes `--config` and `--port`, Vite received each flag twice and used the last one. This works but depends on that ordering; a target without hardcoded flags would be cleaner.
- **Exact error (shared finding, first candidate preparation):** `Preview preparation failed: page.evaluate: Execution context was destroyed, most likely because of a navigation. Retry preview.` **Retry preview** succeeded immediately. I did not determine the cause (possibly a Vite reload while the candidate runtime started). It did not recur.
- **Observation, cause not determined:** after both findings had been viewed, the admin candidate origin 4202 contained both changes (badge `margin-right: 8px` and note `margin-right: 12px`).
- Approve, Validate, Apply and rollback were not exercised.

### 4. Review state and hashes

Both decisions remained **pending**. No review record was written (the state directory contained only `backups/`). The disposable copy's 29 files (excluding `node_modules`, `dist`, `.nx`, `.rtl-preview`, `.rtl-vite-cache`) had identical SHA-256 lists before the scan and after review (hash-of-list `9ad81d5cbaea46ab90df313e70ff044e949b14d66a461b6a8ca4696db97931bb`); the copy's `apps/` and `libs/` matched the checked-in example. The second copy (also reviewed to the Original stage) was identical as well.

## Gaps

- The shared-library finding carries no application attribution in the report (`applications: []`); the apps that render it are known only through the preview mapping. No scanner-level "shared library impact" exists.
- Candidates need `ownerOverrides`; without them both findings are manual (`CSS_SPACING_OWNER_REQUIRES_REVIEW`).
- One transient After failure (see above) and the unexplained shared candidate runtime contents.
- Duplicated Vite flags through Nx (works, order-dependent). Leftover `nx` daemon processes after Companion shutdown.
- Approve/Validate/Apply/rollback for a shared-library change (one edit affecting two apps) not exercised; human acceptance pending.
- Chromium only; desktop width only; no narrow viewport, pointer or keyboard checks; one library, no library-to-library imports, no Nx-inferred targets or `@nx/vite` plugin.
- The matrix has no workspace-specific cases; deferred catalogue IDs: everything except LAYOUT-001.

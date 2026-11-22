# Workspace integration (example project 6)

A small Nx workspace: two React + Vite apps (`storefront`, `admin`) and one shared UI library (`libs/ui`, imported as `@ws/ui` through a Vite alias and tsconfig `paths`). Nx 23.3.0 is used for orchestration only (`nx:run-commands` targets, no Nx Vite plugin). The project matrix (`docs/rtl-analyzer-v3/rtl-ui-catalog.json`) defines no workspace cases, so this slice reuses **LAYOUT-001 (margin)**; the workspace shape and the shared / app-specific / control split are this project's own. Expectations were written to `manifest.json` **before the first install, build or scan**.

**Headline.**

- **Scanner:** finds the shared-library defect once, under `libs/ui/...`, and the admin-only defect under `apps/admin/...`. The shared finding has `applications: []` (no app attribution); the admin one has `["admin"]`.
- **Browser:** both apps show the shared badge defect in RTL (0 px gap); only admin shows the app-specific one.
- **Fix Studio:** Nx startup works. The shared finding previews in both apps, and After closes the RTL gap in both. A second verification pass (below) found that the **live After pane shows every opened finding's edit, not only the selected one** (one shared candidate), that approving/validating/applying one finding writes only its own file, and that rollback restores every hash.

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

Open `http://127.0.0.1:4320/rtl-report-dashboard.html`, choose **Review one by one**, **Start manual review**, step with **Continue to next file**, and leave every decision pending. Stop the Companion with Ctrl-C, then re-run the `find ... > "$run/hashes-after.txt"` line and `diff` the lists.

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
- **Nx startup (first pass, superseded by the second pass):** worked. The Companion ran `npm run dev:<app> -- --config .rtl-preview/vite.<app>.config.mts --host 127.0.0.1 --port 4266|4276 --strictPort`, which Nx expanded onto the command in `project.json`. Because that command already hardcodes `--config` and `--port`, Vite received each flag twice and used the last one. This works but depends on that ordering; a target without hardcoded flags would be cleaner.
- **Exact error (first pass, shared finding, first candidate preparation; cause found in the second pass):** `Preview preparation failed: page.evaluate: Execution context was destroyed, most likely because of a navigation. Retry preview.` **Retry preview** succeeded immediately. I did not determine the cause (possibly a Vite reload while the candidate runtime started). It did not recur.
- **Observation (first pass; cause found in the second pass):** after both findings had been viewed, the admin candidate origin 4202 contained both changes (badge `margin-right: 8px` and note `margin-right: 12px`).
- Approve, Validate, Apply and rollback were not exercised.

### 4. Review state and hashes

Both decisions remained **pending**. No review record was written (the state directory contained only `backups/`). The disposable copy's 29 files (excluding `node_modules`, `dist`, `.nx`, `.rtl-preview`, `.rtl-vite-cache`) had identical SHA-256 lists before the scan and after review (hash-of-list `9ad81d5cbaea46ab90df313e70ff044e949b14d66a461b6a8ca4696db97931bb`); the copy's `apps/` and `libs/` matched the checked-in example. The second copy (also reviewed to the Original stage) was identical as well.

## Second verification pass (2026-11-22, fresh disposable copies for every test)

Same analyzer archive (`94d00198...b07a`, commit `54648af`). Helper scripts were scratch files, not committed. Per-check results:

| # | Check | Result |
|---|---|---|
| 1a | Candidate state reproduced, both orders (admin to shared via UI; shared to admin via the workflow API) | **PASS**: reproduced |
| 1b | Cause of the admin preview showing both edits | **PASS** (explained, see below) |
| 1c | Labeled code Before/After matches each finding's patch | **PASS** |
| 1d | Live After pane shows only the selected finding's change | **FAIL (Analyzer behavior)**: it shows every opened finding |
| 2a | Shared fix only: approve, validate, explicit Apply, only the shared file changes | **PASS** |
| 2b | Both apps reflect the shared fix; admin edit stays Pending | **PASS** |
| 2c | Rollback restores original hashes (shared) | **PASS** (30 of 30; audit `ROLLED_BACK`) |
| 2d | Same for the admin fix only (admin file only; storefront and admin badge unchanged; shared stays Pending) | **PASS**; rollback restored 30 of 30 hashes |
| 3a | Duplicate Vite flags resolved | **PASS** |
| 3b | Nx daemon no longer left after shutdown | **PASS** (0 leftovers on a run without Apply/rollback; see 3f) |
| 3c | First-preview reload error reproduced, cause found, workaround no longer needed | **PASS** |
| 3d | Analyzer reports both consumers of the shared finding | **FAIL (by design)**: path-based only; previews use explicit mappings |
| 3e | Review leaves source hashes unchanged / decisions pending in the baseline | **PASS** |
| 3f | Companion shutdown leaves no process behind after an Apply and Rollback | **FAIL (Analyzer, not isolated)**: orphaned candidate runtime in 2 of 2 runs |

### 1. Candidate state

A one-by-one review has **one workflow, one session, one `candidateRoot`**. `prepare-preview` (source: `review-workflow.ts`, `if(!entry.applied) await this.change(id, entry.finding.id, {action:'apply'})`) applies the opened finding's patch into that candidate, and nothing un-applies it when you move on. Measured with a candidate diff (`diff -ru project candidateRoot`) and computed gaps in Chromium (the Original origins never changed):

| State | `entries[].applied` (admin / shared) | Candidate diff touches | Admin candidate RTL: badge / note gap | Storefront candidate RTL badge gap |
|---|---|---|---|---|
| Order A, admin opened only | true / false | `Admin.module.css` | 0 / 12 px | not started |
| Order A, then shared opened | true / true | both files | 8 / 12 px | 8 px |
| Order B, shared opened first (API) | false / true | `StatusBadge.module.css` | 8 / 0 px | 8 px |
| Order B, then admin opened | true / true | both files | 8 / 12 px | 8 px |

So the admin preview showed both edits because both findings had been opened (cumulative preview), not because the shared fix is "inside" the admin fix. Which candidate port serves which app depends on the order (admin 4202 / storefront 4203 in order A; reversed in order B).

- The per-finding **code Before/After card** was exact in every state (`margin-left: 8px;` to `margin-inline-start: 8px;`, `margin-left: 12px;` to `margin-inline-start: 12px;`) and matched the stored patch and the candidate diff.
- The **live After pane** is the whole composed candidate, so its edits are not limited to the selected finding. The UI only hints at it (the status line of an opened finding says "Review preview only", an unopened one "Not in review preview"). Original panes were always unmodified.
- **Approving and validating narrows it:** Validate recomposed the candidate from the accepted entry only (the other entry went back to `applied=false`, `Pending`) and Apply wrote only that entry's file.

### 2. One decision at a time (disposable copies)

| Step | Shared only | Admin only |
|---|---|---|
| Approve | confirmation: "Your project files have not changed", 1 pending in project | same |
| Validate | "Validation passed, 1 changes validated"; candidate diff = shared file only; source hashes unchanged | same with the admin file |
| Apply confirmation | "Affected files: `libs/ui/src/StatusBadge.module.css`" | "Affected files: `apps/admin/src/Admin.module.css`" |
| Files changed (30 hashed) | exactly `libs/ui/src/StatusBadge.module.css` | exactly `apps/admin/src/Admin.module.css` |
| After Apply, RTL gaps | storefront badge 8 px, admin badge 8 px, admin note 0 px (still pending) | storefront badge 0 px, admin badge 0 px, admin note 12 px |
| Other finding | admin Pending | shared Pending |
| Rollback | hashes restored (30 of 30), audit `APPLY_PREPARED`, `APPLIED`, `ROLLED_BACK`; RTL gaps back to 0 | same |
| After rollback | a fresh review started with both decisions Pending | same |

Apply rescans, so after Apply the dashboard listed only the remaining finding. Rollback is under Review actions and uses a native `window.confirm`; the browser pane declined it silently, so I auto-accepted that single confirm for the page (`window.confirm = () => true`) in the disposable copy only.

### 3. Nx setup

- **Duplicate flags: fixed.** The targets used to hardcode `--config`/`--port`, and the Analyzer appended its own (`vite.js --config apps/admin/vite.config.mjs ... --port 4275 --config <.rtl-preview/...> --port 4276`). They now run plain `vite` from `cwd: apps/<app>`; the config supplies the dev port. Observed: standalone `npm run dev:admin` runs `node ../../node_modules/vite/bin/vite.js`; the Companion's runs carry one `--config/--host/--port/--strictPort` set.
- **Nx daemon: fixed** with `"useDaemonProcess": false` in `nx.json`. The old setup left two `nx` daemons after every Companion shutdown (2 of 2 runs); the new one left none on a run without Apply.
- **First-preview reload error: cause found, workaround no longer needed.** `Preview preparation failed: page.evaluate: Execution context was destroyed, most likely because of a navigation. Retry preview.` occurred on first candidate or Original preparation (1 of 3 old-setup runs, and 2 times in the new setup before the fix, including a fresh candidate after a restart). A cold Vite load navigated **twice**; with `--debug optimize:deps` Vite logged `new dependencies optimized: react/jsx-dev-runtime` then `optimized dependencies changed. reloading`. Adding `optimizeDeps.include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client']` to both Vite configs gave a single navigation on 2 of 2 cold loads (`react/jsx-runtime` alone was not enough) and **0 errors in 4 candidate preparations** (2 fresh runs, both orders, Retry never needed). Retry preview remains the recovery if it ever recurs.
- **Consumers of the shared finding.** `rules.ts` sets `applications: a.path.startsWith('apps/') ? [segment] : []`, so any file under `libs/` gets `applications: []`; the structured report counts it as "Shared or unresolved reachability", and the scanner README says `[]` means unresolved reachability, not zero consumers. There is no import-graph attribution. Both consumers are reachable only through the explicit mapping in `rtl-preview.config.json` (verified: the app selector lists storefront and admin and each renders and previews). Reading `dashboard-client.ts`, an app filter (`f.applications.includes(app)`) would hide the shared finding under either app; I did not click it.

## Analyzer observations (not blocking, Analyzer code unchanged)

1. **Cumulative live After** (repro: start Review one by one, open admin finding, then shared; inspect the session `candidateRoot` or the admin After origin). The After pane for finding N includes finding M's edit.
2. **Leaked candidate runtime after Apply and Rollback** (2 of 2 runs, none in runs without Apply). Repro: Review one by one, approve one finding, Validate, Apply, then Rollback (Review actions), wait for the page to reload, stop the Companion with SIGINT. Left behind: the `npm run dev:<app>` process group (npm, `nx run`, vite, esbuild) of the post-rollback review's candidate `rtl-review-*` root, holding a candidate port until killed with `kill -TERM -<pgid>`. Not isolated further (it could depend on the new review's auto-preview starting just before shutdown).
3. `$TMPDIR/rtl-review-*` candidate roots are not removed (about 20 present after the session).
4. A shared-library finding has `applications: []`.

## Gaps

- The shared-library finding carries no application attribution in the report (`applications: []`); the apps that render it are known only through the preview mapping. No scanner-level "shared library impact" exists.
- Candidates need `ownerOverrides`; without them both findings are manual (`CSS_SPACING_OWNER_REQUIRES_REVIEW`).
- Human acceptance pending (all review decisions are pending in the baseline; the Apply/rollback decision tests ran only on disposable copies).
- Chromium only; desktop width only; no narrow viewport, pointer or keyboard checks; one library, no library-to-library imports, no Nx-inferred targets or `@nx/vite` plugin.
- The matrix has no workspace-specific cases; deferred catalogue IDs: everything except LAYOUT-001.

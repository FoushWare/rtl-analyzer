# Hands-on testing guide for the six example projects

Verification record for `rtl-analyzer` **0.4.0**. General commands below use the versionless `npx rtl-analyzer` (npm `latest`); prerelease testing uses `npx rtl-analyzer@next`. The 0.5.0-rc.1 prerelease has not yet been verified with this guide. Every command was run against this release's exact tarball on macOS (Node 22.21.1, Chromium, desktop width) unless marked **unverified**. The only difference after publication is the install line, which uses the registry (`rtl-analyzer@0.4.0`) instead of a local tarball; the published-package run is recorded in the release record.

Always test in a **disposable copy**. Never scan or apply inside the checked-in `examples/` folders.

## 0. Common setup (once per project)

You need: Node 22.12+, npm, Python 3, `rsync`, and this repository checked out. Replace `REPO` with the checkout path.

Terminal 1 — create the disposable copy, install, scan:

```sh
REPO=~/rtl-analyzer-0.3.0-prep           # your checkout
EX=account-checkout                       # one of the six folder names below
RUN=$(mktemp -d /private/tmp/rtl-$EX.XXXXXX) && echo "$RUN"
mkdir -p "$RUN/reports" "$RUN/state/backups"
rsync -a --exclude node_modules --exclude dist --exclude .next --exclude .nx --exclude '*.tsbuildinfo' "$REPO/examples/$EX/" "$RUN/project/"
cd "$RUN/project"
npm install                               # Workspace Integration: npm ci
npm run check                             # sanity build; every project has this script
rm -rf dist .next .nx
npm install --no-save --package-lock=false rtl-analyzer
npx --no-install playwright install chromium
npx --no-install rtl-analyzer --version   # prints the installed version
npx --no-install rtl-analyzer scan --root "$PWD" --format dashboard --output-dir "$RUN/reports" --embed-source-snippets > /dev/null
# So VS Code shows a clean source diff after Apply:
git init -q && printf '.rtl-preview/\n.rtl-vite-cache/\n' >> .git/info/exclude && git add -A && git -c user.name=t -c user.email=t@t commit -qm baseline
```

Open **`$RUN/project`** in VS Code (File → Open Folder). Source Control then shows nothing until you Apply.

Terminal 2 — review companion (leave running):

```sh
cd "$RUN/project"
export RTL_PROJECT_ROOT="$PWD" RTL_REVIEW_STORE_PATH="$RUN/state/review-records-v1.json" \
  RTL_EVIDENCE_STORE_PATH="$RUN/state/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="$RUN/state/manual-changes-v1.json" \
  RTL_SCAN_MANIFEST_STORE_PATH="$RUN/state/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="$RUN/state/apply-audit-v1.json" \
  RTL_APPLY_BACKUP_ROOT="$RUN/state/backups"
npx --no-install rtl-analyzer preview     # listens on 127.0.0.1:4318
```

(`RUN` must be set in this terminal too: run `RUN=/private/tmp/rtl-<name>.XXXXXX` using the path printed above.)

Terminal 3 — report server (leave running):

```sh
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$RUN/reports"
```

Open <http://127.0.0.1:4320/rtl-report-dashboard.html>. Ports used: 4318 (companion), 4320 (report), the project's own original-preview port (listed per project), and 4202+ for candidates.

**Stop:** press Ctrl-C once in Terminal 2 (verified: a double Ctrl-C, which is what `npx` produces, also leaves nothing behind), then Ctrl-C in Terminal 3. Check:

```sh
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(42[0-9]{2}|423[56]|4318|4320|4266|4276)\b' || echo "all ports free"
```

**Reset** (between projects or after a bad run): stop terminals 2 and 3, then

```sh
rm -rf "$RUN/state" && mkdir -p "$RUN/state/backups"
cd "$RUN/project" && git checkout -- . && git clean -fdq -e node_modules
```

and restart Terminals 2 and 3. If you reset the source, the scan report is still valid only because the source is back to baseline.

> **Unverified:** `npx rtl-analyzer preview` without installing first. The tested path is install, then `npx --no-install`.

## 1. Common checklist (one-by-one mode)

Do this for the starting finding of each project (marked ✅ in its section).

| # | Step | Expect |
| --- | --- | --- |
| 1 | **Scan** done; open the dashboard | Header says *Scan complete*; finding count matches the project section |
| 2 | **Review one by one → Start manual review** | Opens Fix Studio. Source hashes unchanged (VS Code Source Control empty) |
| 3 | **Inspect**: find the named finding (use *Search findings*) | Source line highlighted; *Why this finding?*; code Before/After card |
| 4 | **Preview**: wait for After to say *Preview ready*; click **RTL**, then **LTR**, **Highlight targets** | Before and After differ only in the finding's property. If *Preview preparation failed*, click **Retry preview** and note it |
| 5 | **Decide**: **Approve proposed change** → **Stay on this finding** | Dialog: *Your project files have not changed* |
| 6 | **Validate changes** | *Validation passed — 1 changes validated* (up to ~1 min). Source still unchanged |
| 7 | **Apply 1 changes…** → read the dialog → **Apply to source** | Dialog names the destination and exactly one file |
| 8 | **Check the source diff** in VS Code Source Control | Only that file; the declaration became its logical equivalent |
| 9 | **Rollback**: **Review actions → Rollback applied changes**, accept the browser confirm | Source Control is empty again; a fresh review starts with everything Pending |
| 10 | **Stop** (see above) | *all ports free* |

Notes: Apply shows a *Changes applied* dialog; use **Back to review**. Candidate ports (4202, 4203) are released right after Apply and come back after Rollback when a new preview starts; that is expected. If you edit a file after Apply, Rollback is refused by design.

### Batch-mode pass (run once per project after the one-by-one pass)

| # | Step | Expect |
| --- | --- | --- |
| B1 | Reset (above), reopen the dashboard, choose **Prepare all, then review → Prepare all & review** | Batch review overview with counts *fixes prepared / pending approval / need manual review / approved*. Source unchanged |
| B2 | Click **View diff** on one row | Fix Studio opens on that finding with *Preview ready* (batch After shows all prepared fixes together, by design) |
| B3 | Go back (**Change review mode** or reload), tick **one** row, **Approve selected** | *1 approved*; the other rows stay Pending |
| B4 | **Validate 1 approved changes** → **Apply 1 changes…** → **Apply to source** | Only the ticked row's file changes |
| B5 | **Review actions → Rollback applied changes** | Source Control empty |
| B6 | Stop | *all ports free* |

## 2. The six projects

Open **`$RUN/project`** in VS Code for each. The folder you copied from is `examples/<name>`.

### 2.1 Foundations Lab — `examples/foundations-lab`

- **Stack / ports:** Vite, original preview 4216 (`npm run dev` standalone: 4215).
- **Scan:** 10 findings plus 2 diagnostics (`RTL.DOCUMENT.INITIAL`, `RTL.RUNTIME.DIRECTION_UNKNOWN`).
- **Routes:** `/` (foundations), `/?drawer=account-drawer`, `/?drawer=devices-drawer`.
- **Start with ✅** `RTL.CSS.PHYSICAL` `stylesheet/.physical-start` (`src/lab.css`, `margin-left:auto`). Verified: one-by-one and batch each reach Validate, Apply (only `src/lab.css`) and exact rollback, no retries.
- **Batch:** 8 fixes prepared, 2 need manual review. Verified by approving the first row only.
- **RTL vs LTR:** the manifest records per case what is expected (for example `.edge-bar`: accent on the left in LTR and on the right in RTL; `.transform-broken`: drawer slides from the left in LTR, from the right in RTL). I did not visually measure these in this release. **Unverified by me:** the other eight proposals' Apply.
- **Not a defect:** `.fixed-right` (indicator intentionally stays at the physical right) has no proposal.
- **Example command variant:** none; the standard setup is the tested one.

### 2.2 Account Checkout — `examples/account-checkout`

- **Stack / ports:** React + Vite + CSS Modules, original preview 4226 (standalone `npm run dev`: 4225).
- **Scan:** 3 actionable findings plus 2 diagnostics.
- **Route:** `/` (checkout); direction by `?direction=ltr|rtl` or the page's select.
- **Start with ✅** `RTL.CSS.PHYSICAL` `.editLink` (`margin-left: 24px` → `margin-inline-start`). Verified one-by-one and batch (batch has 2 prepared: `.editLink` and `.couponHint` `text-align: left`), with exact rollback.
- **RTL vs LTR:** the expected result after the fix is that the Edit link's gap follows the start side (left in LTR, right in RTL). I did not measure the rendered gap for this project; compare Before and After yourself in RTL.
- **Review-only case:** `.secureBadge` (`RTL.GEOMETRY.EDGE`, `right: 12px`) has no candidate by design.
- **Changed since earlier docs:** the project README's "first After preview fails" workaround was **not needed** in my runs (0 retries in 2 cold-start runs). Keep it handy; report it if you still hit it.

### 2.3 Admin Dashboard — `examples/admin-dashboard`

- **Stack / ports:** React + Vite + CSS Modules, original preview 4236 (standalone: 4235).
- **Routes:** `orders` (`/`), `details-dialog` (`/?dialog=details`).
- **Scan:** 5 actionable findings plus 2 diagnostics. Batch: **1 prepared, 4 need manual review**.
- **Start with ✅** `RTL.CSS.PHYSICAL` `.dialogTitle` (`margin-right: 24px` → `margin-inline-end`), shown on the details dialog. Verified one-by-one and batch to Validate, Apply (only `src/Dashboard.module.css`) and exact rollback. In RTL the After title has its 24px gap on the left.
- **Known limitation (not fixed in this release):** `.statusBadge` previews (RTL gap 0 → 8 px), but **Validate ends Unavailable** with `DIRECTION_EVIDENCE_AMBIGUOUS_TARGETS`, because three identical badge rows have no unique key. Do not expect Apply for it. Its first After preview can also fail once; **Retry preview** fixes that.
- **Manual-review:** `.amountCell`, `.stickyId`, `.dialog` (no candidate).

### 2.4 Bilingual Storefront — `examples/bilingual-storefront`

- **Stack:** Next.js + Tailwind. **Live Fix Studio preview is unsupported** for Next.js in this release. Use it for the static scan and for reading findings.
- **Prereq:** `npm run check` (`tsc --noEmit`) is the sanity script; `npm run dev` (4245) works for looking at the page at `/?lang=ar` and `/?lang=ar&drawer=open`.
- **Scan:** 8 findings: 3 CSS (`.cart-count`, `.pager-arrow`, `.drawer`), `RTL.ICON.PROGRESSION` `.icon-forward`, 3 utility-class findings (`.ml-6`, `.text-left`; detection only) and `RTL.BIDI.ISOLATION` in `ProductCard.tsx`.
- **What to test:** scan → dashboard → open `.cart-count` and confirm the **Before**/code card and that After reports *Runtime unavailable* (verified; expected). Starting one-by-one on a supported finding ends at *Preview preparation failed: Runtime unavailable*. Mark Validate/Apply/Rollback and batch as **unsupported here**.
- **RTL vs LTR:** inspect the real page at `?lang=ar` (RTL) and `?lang=en` in your own browser after `npm run dev`; I did not measure these.

### 2.5 Interaction Playground — `examples/interaction-playground`

- **Stack / ports:** React + TypeScript + Vite, original preview 4256 (standalone: 4255). Routes `home` and `drawer-open` (`/?drawer=open`).
- **Scan:** 7 CSS findings plus 2 diagnostics.
- **Important:** **every finding is manual review in this release.** Batch shows *0 fixes prepared, 7 need manual review*; one-by-one shows After = *Preview unavailable · Manual review required* (for example `.star + .star` and `.sliderThumb`). Apply and Rollback therefore cannot be exercised here; mark them **unsupported**.
- **What to test:** scan; open `.drawer`, `.sliderFill` and `.star + .star`; read the explanation and Before pane; confirm no Apply is offered. Use the page itself to check keyboard behavior (arrow keys on the slider/rating, Tab order in the drawer) in LTR and RTL. The scanner does **not** detect JavaScript key handling; that is expected.

### 2.6 Workspace Integration — `examples/workspace-integration`

- **Stack / ports:** Nx 23.3.0 + two Vite apps + shared library. Original previews: storefront 4266, admin 4276. Standalone: `npm run dev:storefront` (4265), `npm run dev:admin` (4275). Use `npm ci`.
- **Scan:** 2 actionable findings (+ per-app diagnostics): shared `libs/ui/src/StatusBadge.module.css` `.badge` (`applications: []`, shared) and `apps/admin/src/Admin.module.css` `.refundNote` (admin only).
- **Start with ✅** the shared `.badge` finding.
- **RTL vs LTR:** `.badge` gap is 8 px in LTR; before the fix RTL gap is **0 px** in both apps; after the fix 8 px (computed `margin-right: 8px` in RTL). `.refundNote` (admin only): 12 px in LTR, 0 px in RTL before, 12 px after.
- **Switching between findings (verified, both orders):**
  - **Order A — admin, then shared, then admin:** open `Admin.module.css`, set **RTL**: After shows the note fixed (`margin-right: 12px`) and the badge **not** fixed (`margin-left: 8px`). Open `StatusBadge.module.css`, set **RTL**: badge fixed only. Return to admin: note fixed, badge unfixed again.
  - **Order B — shared first:** After shows the badge fixed; opening admin shows the note fixed and the badge unfixed.
  - After each switch wait for *Preview ready* (a few seconds: the candidate restarts). If it says *failed*, **Retry preview**.
- **Shared fix in both apps (verified):** approve the shared finding only, **Validate**, **Apply**. Then open <http://127.0.0.1:4266/?direction=rtl> (storefront) and <http://127.0.0.1:4276/?direction=rtl> (admin): both badges now have `margin-right: 8px`; the admin refund note still has `margin-left: 12px` (still Pending). Diff: only `libs/ui/src/StatusBadge.module.css`. Rollback restores all 30 files exactly. (Originals run from your source, so the Apply is visible there.)
- **Batch:** 2 fixes prepared, 0 need manual review. Verified: select only the `libs/ui` row, Approve, Validate, Apply (only the shared file), Rollback. **View diff** on the shared row showed After with the badge fixed.
- **Candidate cleanup (verified):** after Apply and after Rollback, no candidate process or port 4202/4203 remains from the finished workflow; after Ctrl-C (also double), nothing remains.

## 3. What was and was not exercised

Verified with the 0.4.0 tarball, in headless Chromium driven by Playwright: the flows above for Workspace Integration (both modes, both orders), Admin Dashboard (`.dialogTitle`, both modes), Account Checkout (both modes) and Foundations Lab (`.physical-start`, both modes); manual-only behavior for Interaction Playground; unsupported live preview for Bilingual Storefront; shutdown cleanup after every flow. I did not click through these with a mouse in VS Code: that is your pass. **Not verified:** other finding types in Foundations Lab, Safari/WebKit and other browsers, narrow viewports, Windows, npm alternatives, `npx rtl-analyzer@0.4.0 preview` without installing, and any behavior of `.statusBadge` Apply.

## 4. Feedback template (send one per recording)

```text
Project / package version: <folder> / rtl-analyzer@0.4.0
Mode: one-by-one | batch
Command(s) run: <paste>
Route or finding: <route, rule + context, e.g. /  RTL.CSS.PHYSICAL .editLink>
Expected result: <from this guide>
Actual result: <what you saw; copy any error text exactly>
What worked: <steps 1–10 / B1–B6 that matched>
Friction (with recording timestamp): <mm:ss — what was confusing or slow>
Source diff after Apply / after Rollback: <files> / <empty?>
Ports free after Stop: yes | no (<output>)
```

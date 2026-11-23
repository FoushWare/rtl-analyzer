# Admin Dashboard

React + Vite + CSS Modules (orders table, details dialog, tabs). Part of the [RTL Analyzer examples](../README.md); this page is all you need for this project.

## What it demonstrates

A dashboard with a table, sticky column, tabs and a details dialog. The scan reports 5 actionable findings plus 2 diagnostics. In batch mode 1 fix is prepared and 4 need manual review.

| Target | Declaration | Expected Analyzer outcome |
| --- | --- | --- |
| `.dialogTitle` | `margin-right: 24px` | supported candidate `margin-inline-end: 24px` |
| `.statusBadge` | `margin-left` | previews, but **Validate is Unavailable** (see limitations) |
| `.amountCell`, `.stickyId`, `.dialog` | alignment, sticky edge, dialog edge | manual review, no candidate |

## Prerequisites

- macOS or Linux shell (zsh/bash). The commands below were verified on macOS only (for 0.4.0); **Windows is unsupported** (protected report and source operations need a POSIX filesystem profile).
- Node.js 22.12+, npm, Python 3, `rsync`, and `git`.
- A clone of this repository. Set `REPO` in the first terminal to its path.
- Internet access to install dependencies, `rtl-analyzer` (npm `latest`; use `rtl-analyzer@next` to try the 0.5.0 prerelease) and Chromium.

Work in a **disposable copy**. Never scan or apply inside `examples/` itself. The copy lives at `/private/tmp/admin-dashboard` (use `/tmp/admin-dashboard` on Linux; unverified). The folder to open in VS Code is **`/private/tmp/admin-dashboard/project`**.

## 1. Set up the disposable copy

Each terminal needs the same path, so every block below begins by setting `RUN=/private/tmp/admin-dashboard` and changing into it. Run this once:

```sh
# Terminal 1 - create the disposable copy, install, scan
REPO="$HOME/rtl-analyzer"                # your clone of https://github.com/FoushWare/rtl-analyzer
RUN=/private/tmp/admin-dashboard
rm -rf "$RUN" && mkdir -p "$RUN/reports" "$RUN/state/backups"
rsync -a --exclude node_modules --exclude dist --exclude .next --exclude .nx --exclude '*.tsbuildinfo' "$REPO/examples/admin-dashboard/" "$RUN/project/"
cd "$RUN/project"
npm install
npm run check
rm -rf dist .next .nx
npm install --no-save --package-lock=false rtl-analyzer
npx --no-install playwright install chromium
npx rtl-analyzer scan --root "$PWD" --format dashboard --output-dir "$RUN/reports" --embed-source-snippets > /dev/null
git init -q && printf '.rtl-preview/\n.rtl-vite-cache/\n' >> .git/info/exclude && git add -A && git -c user.name=t -c user.email=t@t commit -qm baseline
```

Open the copy in VS Code (File → Open Folder → `/private/tmp/admin-dashboard/project`, or `code /private/tmp/admin-dashboard/project` if the `code` command is installed). Source Control stays empty until you apply a fix.

## 2. Run the app

```sh
# Terminal 2 - app (port 4235)
RUN=/private/tmp/admin-dashboard
cd "$RUN/project"
npm run dev
```

Open <http://127.0.0.1:4235/?direction=rtl&dialog=details>.

Press Ctrl-C to stop the app before the next step if you want a quiet machine; it uses a different port from Fix Studio (4236), so it can keep running.

## 3. Open Fix Studio

```sh
# Terminal 3 - review companion (port 4318)
RUN=/private/tmp/admin-dashboard
cd "$RUN/project"
export RTL_PROJECT_ROOT="$PWD" RTL_REVIEW_STORE_PATH="$RUN/state/review-records-v1.json" \
  RTL_EVIDENCE_STORE_PATH="$RUN/state/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="$RUN/state/manual-changes-v1.json" \
  RTL_SCAN_MANIFEST_STORE_PATH="$RUN/state/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="$RUN/state/apply-audit-v1.json" \
  RTL_APPLY_BACKUP_ROOT="$RUN/state/backups"
npx --no-install rtl-analyzer preview
```

```sh
# Terminal 4 - report server (port 4320)
RUN=/private/tmp/admin-dashboard
cd "$RUN/project"
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$RUN/reports"
```

Open <http://127.0.0.1:4320/rtl-report-dashboard.html>. Choose **Review one by one → Start manual review**, or **Prepare all, then review → Prepare all & review** for batch mode.

Ports: 4318 (companion), 4320 (report), 4236 (original app for Fix Studio), 4202 and up (candidates).

## 4. Start here

- **Route / URL:** `http://127.0.0.1:4235/?direction=rtl&dialog=details` (details dialog open). Fix Studio uses routes `orders` and `details-dialog` on port 4236.
- **Finding:** `RTL.CSS.PHYSICAL` on **`.dialogTitle`** in `src/Dashboard.module.css` (`margin-right: 24px`). Select the file in the Project Explorer on the left, then the finding; it uses the `details-dialog` route.

What you should see:

- The dialog title has `margin-right: 24px` as its gap to the close control. **Before** (LTR and RTL): `margin-right: 24px`, `margin-left: 0`.
- **After** (`margin-inline-end: 24px`): LTR unchanged; in RTL the gap moves to the left (`margin-left: 24px`, `margin-right: 0`).
- Direction is set from the URL, so compare the same page at `direction=ltr` and `direction=rtl` (`lang=en|ar` for the storefront).

Then continue: **Preview ready** → **RTL** / **LTR** → **Approve proposed change** → **Validate changes** → **Apply 1 changes…** → **Apply to source**. Check the diff in VS Code Source Control (one file), then **Review actions → Rollback applied changes**. Source Control is empty again.

## 5. Stop and reset

**Stop:** press Ctrl-C in Terminal 3, Terminal 4 and any app terminal, and wait until each prompt returns (a few seconds; longer for the Nx workspace). Then confirm nothing is left. Do not force-kill the companion: a `kill -9` during shutdown can leave a Vite process behind (seen twice while testing); if the check lists a port, stop that process by the PID `lsof` shows.

```sh
# Stop check
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(42[0-9]{2}|4318|4320|4265|4275|4266|4276|4235|4236|4245|4246|4255|4256|4215|4216|4225|4226)\b' || echo "all ports free"
```

**Reset** (stop Terminals 3 and 4 first), then restart them:

```sh
# Reset
RUN=/private/tmp/admin-dashboard
rm -rf "$RUN/state" && mkdir -p "$RUN/state/backups"
cd "$RUN/project" && git checkout -- . && git clean -fdq -e node_modules
```

To start completely over, rerun step 1 (it deletes and recreates the copy). Rollback is refused if you edit a file after applying; reset instead.

## Limitations

- **Windows is not supported in v0.5.0**. Safari, other browsers, other package managers and narrow viewports are unverified.
- **Known limitation: the `.statusBadge` finding cannot be validated or applied.** It previews (RTL gap 0 px before, 8 px after), but Validate ends *Unavailable* with `DIRECTION_EVIDENCE_AMBIGUOUS_TARGETS` because three identical status badges in the table have no unique key. Its first After preview can also fail once; **Retry preview** recovers it. Do not use it as your start finding.
- `.amountCell`, `.stickyId` and `.dialog` are manual review: Fix Studio shows Before and an explanation, no After.
- Live review needs Chromium and trusted project scripts. Details: [advanced setup guide](../../docs/guides/developer-testing.md).

## Verified

Checked on 2026-11-22 (macOS arm64, Node 22.21.1, headless Chromium driven by Playwright). The 0.4.0 run used the commands in the blocks above with `rtl-analyzer@0.4.0` pinned in place of the versionless command, unchanged apart from `REPO`, in a fresh `/private/tmp/admin-dashboard` copy against the published `rtl-analyzer@0.4.0`. It has not been re-run against `rtl-analyzer@0.5.0-rc.1`.

Scan step against the published `rtl-analyzer@0.5.0-rc.1` (2026-11-23): **passed** (exit 0, dashboard produced, 7 findings). Live Preview, Fix Studio, Apply and Rollback against `0.5.0-rc.1`: **not verified**. Results: setup, check and scan succeeded; the details-dialog route and measurements matched. **One by one** on `.dialogTitle`: Preview ready (0 retries), Validate passed, Apply changed only `src/Dashboard.module.css`, Rollback restored every hash. **Batch:** 1 prepared, 4 manual; approve, Validate, Apply, Rollback passed. `all ports free`; Reset clean. The `.statusBadge` limitation was observed earlier on 2026-11-22 with the same 0.4.0 build (Validate Unavailable, `DIRECTION_EVIDENCE_AMBIGUOUS_TARGETS`) and was **not** rerun for this page. **Not verified:** the manual-review findings beyond reading them.

Earlier notes from building this example are kept in [the verification history](../../docs/verification/examples-history/admin-dashboard.md); they predate 0.4.0.

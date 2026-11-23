# Interaction Playground

React 19 + TypeScript + Vite + CSS Modules. Part of the [RTL Analyzer examples](../README.md); this page is all you need for this project.

## What it demonstrates

Keyboard and focus behavior: a drawer, rating, custom slider, tabs and toolbar. The scan reports 7 CSS findings plus 2 diagnostics. **Every finding is manual review: no change is proposed, so there is nothing to Validate, Apply or roll back.** JavaScript key handling (arrow keys in tabs and rating) is not detectable by the scanner.

| Target | Declaration | Expected Analyzer outcome |
| --- | --- | --- |
| `.drawer` | `left: 0` + `translateX(-100%)` | edge and order findings, manual |
| `.star + .star` | `margin-left: 6px` | manual (`CSS_SPACING_SIMPLE_CLASS_SELECTOR_REQUIRED`) |
| `.sliderFill`, `.sliderThumb` | physical `left` | manual |
| `Tabs.tsx` arrow keys | JavaScript | no finding (expected miss) |

## Prerequisites

- macOS or Linux shell (zsh/bash). The commands below were verified on macOS only (for 0.4.0); **Windows is unsupported** (protected report and source operations need a POSIX filesystem profile).
- Node.js 22.12+, npm, Python 3, `rsync`, and `git`.
- A clone of this repository. Set `REPO` in the first terminal to its path.
- Internet access to install dependencies, `rtl-analyzer` (npm `latest`; use `rtl-analyzer@next` to try the 0.5.0 prerelease) and Chromium.

Work in a **disposable copy**. Never scan or apply inside `examples/` itself. The copy lives at `/private/tmp/interaction-playground` (use `/tmp/interaction-playground` on Linux; unverified). The folder to open in VS Code is **`/private/tmp/interaction-playground/project`**.

## 1. Set up the disposable copy

Each terminal needs the same path, so every block below begins by setting `RUN=/private/tmp/interaction-playground` and changing into it. Run this once:

```sh
# Terminal 1 - create the disposable copy, install, scan
REPO="$HOME/rtl-analyzer"                # your clone of https://github.com/FoushWare/rtl-analyzer
RUN=/private/tmp/interaction-playground
rm -rf "$RUN" && mkdir -p "$RUN/reports" "$RUN/state/backups"
rsync -a --exclude node_modules --exclude dist --exclude .next --exclude .nx --exclude '*.tsbuildinfo' "$REPO/examples/interaction-playground/" "$RUN/project/"
cd "$RUN/project"
npm install
npm run check
rm -rf dist .next .nx
npm install --no-save --package-lock=false rtl-analyzer
npx --no-install playwright install chromium
npx rtl-analyzer scan --root "$PWD" --format dashboard --output-dir "$RUN/reports" --embed-source-snippets > /dev/null
git init -q && printf '.rtl-preview/\n.rtl-vite-cache/\n' >> .git/info/exclude && git add -A && git -c user.name=t -c user.email=t@t commit -qm baseline
```

Open the copy in VS Code (File → Open Folder → `/private/tmp/interaction-playground/project`, or `code /private/tmp/interaction-playground/project` if the `code` command is installed). Source Control stays empty until you apply a fix.

## 2. Run the app

```sh
# Terminal 2 - app (port 4255)
RUN=/private/tmp/interaction-playground
cd "$RUN/project"
npm run dev
```

Open <http://127.0.0.1:4255/?direction=rtl&drawer=open>.

Press Ctrl-C to stop the app before the next step if you want a quiet machine; it uses a different port from Fix Studio (4256), so it can keep running.

## 3. Open Fix Studio

```sh
# Terminal 3 - review companion (port 4318)
RUN=/private/tmp/interaction-playground
cd "$RUN/project"
export RTL_PROJECT_ROOT="$PWD" RTL_REVIEW_STORE_PATH="$RUN/state/review-records-v1.json" \
  RTL_EVIDENCE_STORE_PATH="$RUN/state/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="$RUN/state/manual-changes-v1.json" \
  RTL_SCAN_MANIFEST_STORE_PATH="$RUN/state/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="$RUN/state/apply-audit-v1.json" \
  RTL_APPLY_BACKUP_ROOT="$RUN/state/backups"
npx --no-install rtl-analyzer preview
```

```sh
# Terminal 4 - report server (port 4320)
RUN=/private/tmp/interaction-playground
cd "$RUN/project"
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$RUN/reports"
```

Open <http://127.0.0.1:4320/rtl-report-dashboard.html>. Choose **Review one by one → Start manual review**, or **Prepare all, then review → Prepare all & review** for batch mode.

Ports: 4318 (companion), 4320 (report), 4256 (original app for Fix Studio), 4202 and up (candidates).

## 4. Start here

- **Route / URL:** `http://127.0.0.1:4255/?direction=rtl&drawer=open` (open drawer). Fix Studio uses routes `home` and `drawer-open` on port 4256.
- **Finding:** `RTL.GEOMETRY.EDGE` on **`.drawer`** in `src/Interaction.module.css` (`left: 0`). Select the file in the Project Explorer on the left, then the finding.

What you should see:

- **LTR:** the drawer slides in from the left. **RTL:** it still opens from the left (the defect: it should open from the start edge, the right).
- Keyboard (try it in the app, not in Fix Studio): in RTL, ArrowRight in the rating and tabs moves focus visually left. The scanner does not report this.
- Direction is set from the URL, so compare the same page at `direction=ltr` and `direction=rtl` (`lang=en|ar` for the storefront).

## 5. Stop and reset

**Stop:** press Ctrl-C in Terminal 3, Terminal 4 and any app terminal, and wait until each prompt returns (a few seconds; longer for the Nx workspace). Then confirm nothing is left. Do not force-kill the companion: a `kill -9` during shutdown can leave a Vite process behind (seen twice while testing); if the check lists a port, stop that process by the PID `lsof` shows.

```sh
# Stop check
lsof -nP -iTCP -sTCP:LISTEN | grep -E ':(42[0-9]{2}|4318|4320|4265|4275|4266|4276|4235|4236|4245|4246|4255|4256|4215|4216|4225|4226)\b' || echo "all ports free"
```

**Reset** (stop Terminals 3 and 4 first), then restart them:

```sh
# Reset
RUN=/private/tmp/interaction-playground
rm -rf "$RUN/state" && mkdir -p "$RUN/state/backups"
cd "$RUN/project" && git checkout -- . && git clean -fdq -e node_modules
```

To start completely over, rerun step 1 (it deletes and recreates the copy). Rollback is refused if you edit a file after applying; reset instead.

## Limitations

- **Windows is not supported in v0.5.0**. Safari, other browsers, other package managers and narrow viewports are unverified.
- **Manual-only.** In Fix Studio the After pane shows *Preview unavailable · Manual review required*; in batch mode the overview shows *0 fixes prepared*. Apply and Rollback are not available.
- Keyboard and focus order are checked by hand in the running app.
- Live review needs Chromium and trusted project scripts. Details: [advanced setup guide](../../docs/guides/developer-testing.md).

## Verified

Checked on 2026-11-22 (macOS arm64, Node 22.21.1, headless Chromium driven by Playwright). The 0.4.0 run used the commands in the blocks above with `rtl-analyzer@0.4.0` pinned in place of the versionless command, unchanged apart from `REPO`, in a fresh `/private/tmp/interaction-playground` copy against the published `rtl-analyzer@0.4.0`. It has not been re-run against `rtl-analyzer@0.5.0-rc.1`.

Scan step against the published `rtl-analyzer@0.5.0-rc.1` (2026-11-23): **passed** (exit 0, dashboard produced, 9 findings). Live Preview, Fix Studio, Apply and Rollback against `0.5.0-rc.1`: **not verified**. Results: setup, check and scan succeeded; the open drawer measured at the left edge (0 to 292 px of a 1280 px window) in both LTR and RTL. In Fix Studio `.drawer` showed *Manual review required · No supported candidate preview*; batch mode showed *0 fixes prepared, 7 need manual review*. No Validate, Apply or Rollback was possible. `all ports free`; Reset clean. **Not verified:** keyboard and focus behavior (checked by hand only in earlier notes), `.star + .star` and slider findings in the UI.

Earlier notes from building this example are kept in [the verification history](../../docs/verification/examples-history/interaction-playground.md); they predate 0.4.0.

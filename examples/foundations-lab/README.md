# Foundations Lab

Vite + vanilla JavaScript (Northstar account page). Part of the [RTL Analyzer examples](../README.md); this page is all you need for this project.

## What it demonstrates

Direction, spacing, edge positioning, transforms and drawers on one realistic account page. The scan reports 10 actionable findings plus 2 diagnostics (`RTL.DOCUMENT.INITIAL`, `RTL.RUNTIME.DIRECTION_UNKNOWN`). Names and contact details are synthetic.

| Target | Declaration | Expected Analyzer outcome |
| --- | --- | --- |
| `.physical-start` | `margin-left: auto` | supported candidate (`margin-inline-start: auto`) |
| `.edge-bar`, `.transform-broken`, `.position-box .badge`, `.corner-bubble`, `.shadow-drawer`, `.double-row` | border, transform, offset, shorthand, order | configured proposals or manual review; see Fix Studio |
| `.fixed-right` | `right` offset | intentional physical side; no proposal |

## Prerequisites

- macOS or Linux shell (zsh/bash). The commands below were verified on macOS only; **Windows is unsupported** (protected report and source operations need a POSIX filesystem profile).
- Node.js 22.12+, npm, Python 3, `rsync`, and `git`.
- A clone of this repository. Set `REPO` in the first terminal to its path.
- Internet access to install dependencies, `rtl-analyzer@0.4.0` and Chromium.

Work in a **disposable copy**. Never scan or apply inside `examples/` itself. The copy lives at `/private/tmp/foundations-lab` (use `/tmp/foundations-lab` on Linux; unverified). The folder to open in VS Code is **`/private/tmp/foundations-lab/project`**.

## 1. Set up the disposable copy

Each terminal needs the same path, so every block below begins by setting `RUN=/private/tmp/foundations-lab` and changing into it. Run this once:

```sh
# Terminal 1 - create the disposable copy, install, scan
REPO="$HOME/rtl-analyzer"                # your clone of https://github.com/FoushWare/rtl-analyzer
RUN=/private/tmp/foundations-lab
rm -rf "$RUN" && mkdir -p "$RUN/reports" "$RUN/state/backups"
rsync -a --exclude node_modules --exclude dist --exclude .next --exclude .nx --exclude '*.tsbuildinfo' "$REPO/examples/foundations-lab/" "$RUN/project/"
cd "$RUN/project"
npm install
npm run check
rm -rf dist .next .nx
npm install --no-save --package-lock=false rtl-analyzer@0.4.0
npx --no-install playwright install chromium
npx rtl-analyzer@0.4.0 scan --root "$PWD" --format dashboard --output-dir "$RUN/reports" --embed-source-snippets > /dev/null
git init -q && printf '.rtl-preview/\n.rtl-vite-cache/\n' >> .git/info/exclude && git add -A && git -c user.name=t -c user.email=t@t commit -qm baseline
```

Open the copy in VS Code (File → Open Folder → `/private/tmp/foundations-lab/project`, or `code /private/tmp/foundations-lab/project` if the `code` command is installed). Source Control stays empty until you apply a fix.

## 2. Run the app

```sh
# Terminal 2 - app (port 4215)
RUN=/private/tmp/foundations-lab
cd "$RUN/project"
npm run dev
```

Open <http://127.0.0.1:4215/?direction=rtl>.

Press Ctrl-C to stop the app before the next step if you want a quiet machine; it uses a different port from Fix Studio (4216), so it can keep running.

## 3. Open Fix Studio

```sh
# Terminal 3 - review companion (port 4318)
RUN=/private/tmp/foundations-lab
cd "$RUN/project"
export RTL_PROJECT_ROOT="$PWD" RTL_REVIEW_STORE_PATH="$RUN/state/review-records-v1.json" \
  RTL_EVIDENCE_STORE_PATH="$RUN/state/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="$RUN/state/manual-changes-v1.json" \
  RTL_SCAN_MANIFEST_STORE_PATH="$RUN/state/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="$RUN/state/apply-audit-v1.json" \
  RTL_APPLY_BACKUP_ROOT="$RUN/state/backups"
npx --no-install rtl-analyzer preview
```

```sh
# Terminal 4 - report server (port 4320)
RUN=/private/tmp/foundations-lab
cd "$RUN/project"
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$RUN/reports"
```

Open <http://127.0.0.1:4320/rtl-report-dashboard.html>. Choose **Review one by one → Start manual review**, or **Prepare all, then review → Prepare all & review** for batch mode.

Ports: 4318 (companion), 4320 (report), 4216 (original app for Fix Studio), 4202 and up (candidates).

## 4. Start here

- **Route / URL:** `http://127.0.0.1:4215/?direction=rtl` (and `?direction=ltr`). Drawers: `&drawer=account-drawer`, `&drawer=devices-drawer`.
- **Finding:** `RTL.CSS.PHYSICAL` on **`.physical-start`** in `src/lab.css` (`margin-left: auto`). Select the file in the Project Explorer on the left, then the finding.

What you should see:

- The “View profile” chip (`.physical-start`) has `margin-left: auto`. Measured at a 1280 px-wide window (values scale with the window): **Before, LTR:** `margin-left` ≈ 308.6 px, `margin-right` 0, so the chip sits at the right (end) edge. **Before, RTL:** both margins ≈ 154 px, so the chip floats in the middle of its row instead of at the end edge.
- **After** (`margin-inline-start: auto`): LTR is unchanged. RTL becomes `margin-left` 0 and `margin-right` ≈ 308.6 px, so the chip sits at the left (end) edge, the mirror of LTR.
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
RUN=/private/tmp/foundations-lab
rm -rf "$RUN/state" && mkdir -p "$RUN/state/backups"
cd "$RUN/project" && git checkout -- . && git clean -fdq -e node_modules
```

To start completely over, rerun step 1 (it deletes and recreates the copy). Rollback is refused if you edit a file after applying; reset instead.

## Limitations

- **Windows is unsupported**, and the Windows CI leg fails. Safari, other browsers, other package managers and narrow viewports are unverified.
- The 10 findings are not all fixable: `.fixed-right` has no proposal by design and mobile navigation stays manual. Only `.physical-start` was run through Validate, Apply and rollback for this README.
- Other findings may show *Manual review required* or need `cssProposals`; see [the CSS proposal guide](../../docs/guides/css-proposal-setup.md).
- Live review needs Chromium and trusted project scripts. Details: [advanced setup guide](../../docs/guides/developer-testing.md).

## Verified

Checked on 2026-11-22 (macOS arm64, Node 22.21.1, headless Chromium driven by Playwright). I ran the commands in the blocks above, unchanged apart from `REPO`, in a fresh `/private/tmp/foundations-lab` copy against the published `rtl-analyzer@0.4.0`. Results: setup, `npm run check` and the scan succeeded; the app URL, companion and report server responded; the Before/After numbers above were measured in the app and in Fix Studio. **One by one** on `.physical-start`: Preview ready (0 retries), Approve, Validate passed, Apply changed only `src/lab.css`, Rollback restored every file hash. **Batch:** 8 fixes prepared, 2 need manual review; approving the first row, Validate, Apply (only `src/lab.css`) and Rollback passed. After stopping, `all ports free`; Reset left Git clean. **Not verified:** Apply of the other findings, a mouse-driven pass in VS Code.

Earlier notes from building this example are kept in [the verification history](../../docs/verification/examples-history/foundations-lab.md); they predate 0.4.0.

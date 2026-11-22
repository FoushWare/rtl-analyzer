# Account Checkout

React + Vite + CSS Modules. Part of the [RTL Analyzer examples](../README.md); this page is all you need for this project.

## What it demonstrates

A checkout with four intentional cases. The scan reports 3 actionable findings plus 2 diagnostics.

| Target | Declaration | Expected Analyzer outcome |
| --- | --- | --- |
| `.editLink` | `margin-left: 24px` | supported candidate `margin-inline-start` |
| `.couponHint` | `text-align: left` | supported candidate `text-align: start` |
| `.secureBadge` | `right: 12px` | finding, no candidate: a human must decide between a fixed trust position and one that follows inline-end |
| `.payment`, `.cardNumber`, `.totalRow` | logical or direction-neutral | no finding (clean controls) |

## Prerequisites

- macOS or Linux shell (zsh/bash). The commands below were verified on macOS only; **Windows is unsupported** (protected report and source operations need a POSIX filesystem profile).
- Node.js 22.12+, npm, Python 3, `rsync`, and `git`.
- A clone of this repository. Set `REPO` in the first terminal to its path.
- Internet access to install dependencies, `rtl-analyzer@0.4.0` and Chromium.

Work in a **disposable copy**. Never scan or apply inside `examples/` itself. The copy lives at `/private/tmp/account-checkout` (use `/tmp/account-checkout` on Linux; unverified). The folder to open in VS Code is **`/private/tmp/account-checkout/project`**.

## 1. Set up the disposable copy

Each terminal needs the same path, so every block below begins by setting `RUN=/private/tmp/account-checkout` and changing into it. Run this once:

```sh
# Terminal 1 - create the disposable copy, install, scan
REPO="$HOME/rtl-analyzer"                # your clone of https://github.com/FoushWare/rtl-analyzer
RUN=/private/tmp/account-checkout
rm -rf "$RUN" && mkdir -p "$RUN/reports" "$RUN/state/backups"
rsync -a --exclude node_modules --exclude dist --exclude .next --exclude .nx --exclude '*.tsbuildinfo' "$REPO/examples/account-checkout/" "$RUN/project/"
cd "$RUN/project"
npm install
npm run check
rm -rf dist .next .nx
npm install --no-save --package-lock=false rtl-analyzer@0.4.0
npx --no-install playwright install chromium
npx rtl-analyzer@0.4.0 scan --root "$PWD" --format dashboard --output-dir "$RUN/reports" --embed-source-snippets > /dev/null
git init -q && printf '.rtl-preview/\n.rtl-vite-cache/\n' >> .git/info/exclude && git add -A && git -c user.name=t -c user.email=t@t commit -qm baseline
```

Open the copy in VS Code (File → Open Folder → `/private/tmp/account-checkout/project`, or `code /private/tmp/account-checkout/project` if the `code` command is installed). Source Control stays empty until you apply a fix.

## 2. Run the app

```sh
# Terminal 2 - app (port 4225)
RUN=/private/tmp/account-checkout
cd "$RUN/project"
npm run dev
```

Open <http://127.0.0.1:4225/?direction=rtl>.

Press Ctrl-C to stop the app before the next step if you want a quiet machine; it uses a different port from Fix Studio (4226), so it can keep running.

## 3. Open Fix Studio

```sh
# Terminal 3 - review companion (port 4318)
RUN=/private/tmp/account-checkout
cd "$RUN/project"
export RTL_PROJECT_ROOT="$PWD" RTL_REVIEW_STORE_PATH="$RUN/state/review-records-v1.json" \
  RTL_EVIDENCE_STORE_PATH="$RUN/state/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="$RUN/state/manual-changes-v1.json" \
  RTL_SCAN_MANIFEST_STORE_PATH="$RUN/state/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="$RUN/state/apply-audit-v1.json" \
  RTL_APPLY_BACKUP_ROOT="$RUN/state/backups"
npx --no-install rtl-analyzer preview
```

```sh
# Terminal 4 - report server (port 4320)
RUN=/private/tmp/account-checkout
cd "$RUN/project"
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$RUN/reports"
```

Open <http://127.0.0.1:4320/rtl-report-dashboard.html>. Choose **Review one by one → Start manual review**, or **Prepare all, then review → Prepare all & review** for batch mode.

Ports: 4318 (companion), 4320 (report), 4226 (original app for Fix Studio), 4202 and up (candidates).

## 4. Start here

- **Route / URL:** `http://127.0.0.1:4225/?direction=rtl` (checkout page; `?direction=ltr|rtl`, or use the page’s select). Fix Studio uses the `checkout` route on port 4226.
- **Finding:** `RTL.CSS.PHYSICAL` on **`.editLink`** in `src/Checkout.module.css` (`margin-left: 24px`). Select the file in the Project Explorer on the left, then the finding.

What you should see:

- The “Edit” link has `margin-left: 24px`. **Before** (LTR and RTL): computed `margin-left` is `24px`, `margin-right` is `0`.
- **After** (`margin-inline-start: 24px`): LTR unchanged; in RTL the gap moves to the right (`margin-right: 24px`, `margin-left: 0`).
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
RUN=/private/tmp/account-checkout
rm -rf "$RUN/state" && mkdir -p "$RUN/state/backups"
cd "$RUN/project" && git checkout -- . && git clean -fdq -e node_modules
```

To start completely over, rerun step 1 (it deletes and recreates the copy). Rollback is refused if you edit a file after applying; reset instead.

## Limitations

- **Windows is unsupported**, and the Windows CI leg fails. Safari, other browsers, other package managers and narrow viewports are unverified.
- `.secureBadge` is review-only by design.
- Earlier versions needed a manual “open the candidate URL, then Retry preview” workaround on the first preview. It was not needed in the runs recorded below; if you still see *Preview preparation failed*, select **Retry preview** and tell us.
- Live review needs Chromium and trusted project scripts. Details: [advanced setup guide](../../docs/guides/developer-testing.md).

## Verified

Checked on 2026-11-22 (macOS arm64, Node 22.21.1, headless Chromium driven by Playwright). I ran the commands in the blocks above, unchanged apart from `REPO`, in a fresh `/private/tmp/account-checkout` copy against the published `rtl-analyzer@0.4.0`. Results: setup, check and scan succeeded; the Before/After numbers above matched in the app and Fix Studio. **One by one** on `.editLink`: Preview ready (0 retries), Validate passed, Apply changed only `src/Checkout.module.css`, Rollback restored every hash. **Batch:** 2 prepared (`.editLink`, `.couponHint`), 1 manual; approving the first row, Validate, Apply, Rollback passed. `all ports free`; Reset clean. **Not verified:** `.couponHint` Apply, mouse-driven VS Code pass.

Earlier notes from building this example are kept in [the verification history](../../docs/verification/examples-history/account-checkout.md); they predate 0.4.0.

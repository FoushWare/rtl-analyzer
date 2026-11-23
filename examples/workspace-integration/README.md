# Workspace Integration

Nx 23.3.0 workspace: two React + Vite apps (`storefront`, `admin`) and a shared UI library (`libs/ui`). Part of the [RTL Analyzer examples](../README.md); this page is all you need for this project.

## What it demonstrates

One shared-library defect that appears in both apps, one admin-only defect and a clean control. The scan reports 2 actionable findings plus per-app diagnostics.

| Target | Declaration | Expected Analyzer outcome |
| --- | --- | --- |
| `libs/ui/src/StatusBadge.module.css` `.badge` | `margin-left: 8px` (shared) | supported candidate `margin-inline-start: 8px`, previews in both apps; `applications: []` in the report |
| `apps/admin/src/Admin.module.css` `.refundNote` | `margin-left: 12px` (admin only) | supported candidate, previews in admin only |
| `InfoCard`, `.promo`, rest of `Admin.module.css` | logical CSS | no finding |

## Prerequisites

- macOS or Linux shell (zsh/bash). The commands below were verified on macOS only (for 0.4.0); **Windows is unsupported** (protected report and source operations need a POSIX filesystem profile).
- Node.js 22.12+, npm, Python 3, `rsync`, and `git`.
- A clone of this repository. Set `REPO` in the first terminal to its path.
- Internet access to install dependencies, `rtl-analyzer` (npm `latest`; use `rtl-analyzer@next` to try the 0.5.0 prerelease) and Chromium.

Work in a **disposable copy**. Never scan or apply inside `examples/` itself. The copy lives at `/private/tmp/workspace-integration` (use `/tmp/workspace-integration` on Linux; unverified). The folder to open in VS Code is **`/private/tmp/workspace-integration/project`**.

## 1. Set up the disposable copy

Each terminal needs the same path, so every block below begins by setting `RUN=/private/tmp/workspace-integration` and changing into it. Run this once:

```sh
# Terminal 1 - create the disposable copy, install, scan
REPO="$HOME/rtl-analyzer"                # your clone of https://github.com/FoushWare/rtl-analyzer
RUN=/private/tmp/workspace-integration
rm -rf "$RUN" && mkdir -p "$RUN/reports" "$RUN/state/backups"
rsync -a --exclude node_modules --exclude dist --exclude .next --exclude .nx --exclude '*.tsbuildinfo' "$REPO/examples/workspace-integration/" "$RUN/project/"
cd "$RUN/project"
npm ci
npm run check
rm -rf dist .next .nx
npm install --no-save --package-lock=false rtl-analyzer
npx --no-install playwright install chromium
npx rtl-analyzer scan --root "$PWD" --format dashboard --output-dir "$RUN/reports" --embed-source-snippets > /dev/null
git init -q && printf '.rtl-preview/\n.rtl-vite-cache/\n' >> .git/info/exclude && git add -A && git -c user.name=t -c user.email=t@t commit -qm baseline
```

Open the copy in VS Code (File → Open Folder → `/private/tmp/workspace-integration/project`, or `code /private/tmp/workspace-integration/project` if the `code` command is installed). Source Control stays empty until you apply a fix.

## 2. Run the app

```sh
# Terminal 2a - app (port 4265)
RUN=/private/tmp/workspace-integration
cd "$RUN/project"
npm run dev:storefront
```

Open <http://127.0.0.1:4265/?direction=rtl>.

```sh
# Terminal 2b - app (port 4275)
RUN=/private/tmp/workspace-integration
cd "$RUN/project"
npm run dev:admin
```

Open <http://127.0.0.1:4275/?direction=rtl>.

Press Ctrl-C to stop the app before the next step if you want a quiet machine; it uses a different port from Fix Studio (4266 (storefront) and 4276 (admin)), so it can keep running.

## 3. Open Fix Studio

```sh
# Terminal 3 - review companion (port 4318)
RUN=/private/tmp/workspace-integration
cd "$RUN/project"
export RTL_PROJECT_ROOT="$PWD" RTL_REVIEW_STORE_PATH="$RUN/state/review-records-v1.json" \
  RTL_EVIDENCE_STORE_PATH="$RUN/state/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="$RUN/state/manual-changes-v1.json" \
  RTL_SCAN_MANIFEST_STORE_PATH="$RUN/state/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="$RUN/state/apply-audit-v1.json" \
  RTL_APPLY_BACKUP_ROOT="$RUN/state/backups"
npx --no-install rtl-analyzer preview
```

```sh
# Terminal 4 - report server (port 4320)
RUN=/private/tmp/workspace-integration
cd "$RUN/project"
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$RUN/reports"
```

Open <http://127.0.0.1:4320/rtl-report-dashboard.html>. Choose **Review one by one → Start manual review**, or **Prepare all, then review → Prepare all & review** for batch mode.

Ports: 4318 (companion), 4320 (report), 4266 (storefront) and 4276 (admin) (original app for Fix Studio), 4202 and up (candidates).

## 4. Start here

- **Route / URL:** `http://127.0.0.1:4265/?direction=rtl` (storefront) and `http://127.0.0.1:4275/?direction=rtl` (admin).
- **Finding:** `RTL.CSS.PHYSICAL` on the shared **`.badge`** in `libs/ui/src/StatusBadge.module.css` (`margin-left: 8px`). Select the file in the Project Explorer on the left, then the finding.

What you should see:

- The status badge gap is `8px` in LTR. **Before** (RTL, both apps): `margin-left: 8px`, `margin-right: 0`, so the gap is on the wrong side.
- **After** (`margin-inline-start: 8px`): RTL `margin-right: 8px`, `margin-left: 0`, in both apps. The admin refund note (`.refundNote`) is a separate finding and stays unfixed until you accept it.
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
RUN=/private/tmp/workspace-integration
rm -rf "$RUN/state" && mkdir -p "$RUN/state/backups"
cd "$RUN/project" && git checkout -- . && git clean -fdq -e node_modules
```

To start completely over, rerun step 1 (it deletes and recreates the copy). Rollback is refused if you edit a file after applying; reset instead.

## Limitations

- **Windows is not supported in v0.5.0**. Safari, other browsers, other package managers and narrow viewports are unverified.
- Previews cover only the findings bound in `rtl-preview.config.json`; the report itself does not list which apps consume a shared-library finding.
- In Review one by one, After shows only the selected finding; switching findings restarts the candidate runtime (a few seconds).
- Live review needs Chromium and trusted project scripts. Details: [advanced setup guide](../../docs/guides/developer-testing.md).

## Verified

Checked on 2026-11-22 (macOS arm64, Node 22.21.1, headless Chromium driven by Playwright). The 0.4.0 run used the commands in the blocks above with `rtl-analyzer@0.4.0` pinned in place of the versionless command, unchanged apart from `REPO`, in a fresh `/private/tmp/workspace-integration` copy against the published `rtl-analyzer@0.4.0`. It has not been re-run against `rtl-analyzer@0.5.0-rc.1`.

Scan step against the published `rtl-analyzer@0.5.0-rc.1` (2026-11-23): **passed** (exit 0, dashboard produced, 6 findings). Live Preview, Fix Studio, Apply and Rollback against `0.5.0-rc.1`: **not verified**. Results: `npm ci`, check and scan succeeded; both app URLs responded; the badge numbers above were measured in the storefront app and in Fix Studio. **One by one** on the shared `.badge`: Preview ready (0 retries), Validate passed, Apply changed only `libs/ui/src/StatusBadge.module.css`, candidate ports 4202 and 4203 were released after Apply, Rollback restored every hash. **Batch:** 2 prepared, 0 manual; approving the first row (the admin `.refundNote`), Validate, Apply (only `apps/admin/src/Admin.module.css`) and Rollback passed. After Ctrl-C and waiting for the prompts, `all ports free`; Reset clean. Earlier on 2026-11-22 with the same build I also checked switching between the admin and shared findings in both orders (After shows only the selected finding) and the shared fix in both apps; that was **not** rerun for this page. **Not verified:** the admin-only fix in the admin app's After pane via these exact commands.

Earlier notes from building this example are kept in [the verification history](../../docs/verification/examples-history/workspace-integration.md); they predate 0.4.0.

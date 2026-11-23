# Bilingual Storefront

Next.js 15 (App Router) + TypeScript + Tailwind 3. Part of the [RTL Analyzer examples](../README.md); this page is all you need for this project.

## What it demonstrates

An English (LTR) and Arabic (RTL) storefront with a header, breadcrumb, pagination, icons and a mobile drawer. The scan reports 8 findings (3 CSS, 1 icon, 3 utility-class, 1 bidi isolation) plus 2 diagnostics. **Static scan only: live Fix Studio preview is unsupported for Next.js.**

| Target | Declaration | Expected Analyzer outcome |
| --- | --- | --- |
| `.cart-count`, `.pager-arrow` | `margin-left` | finding; live preview unsupported |
| `.icon-forward` | marked `rtl-icon: progression-right` | `RTL.ICON.PROGRESSION` finding |
| `.drawer` | `left: 0` | finding, manual |
| `ml-6`, `text-left` (Tailwind) | utility classes | detection only, no candidate |
| `.icon-back` (unmarked), breadcrumb, neutral icons | — | no finding (expected) |

## Prerequisites

- macOS or Linux shell (zsh/bash). The commands below were verified on macOS only (for 0.4.0); **Windows is unsupported** (protected report and source operations need a POSIX filesystem profile).
- Node.js 22.12+, npm, Python 3, `rsync`, and `git`.
- A clone of this repository. Set `REPO` in the first terminal to its path.
- Internet access to install dependencies, `rtl-analyzer` (npm `latest`; use `rtl-analyzer@next` to try the 0.5.0 prerelease) and Chromium.

Work in a **disposable copy**. Never scan or apply inside `examples/` itself. The copy lives at `/private/tmp/bilingual-storefront` (use `/tmp/bilingual-storefront` on Linux; unverified). The folder to open in VS Code is **`/private/tmp/bilingual-storefront/project`**.

## 1. Set up the disposable copy

Each terminal needs the same path, so every block below begins by setting `RUN=/private/tmp/bilingual-storefront` and changing into it. Run this once:

```sh
# Terminal 1 - create the disposable copy, install, scan
REPO="$HOME/rtl-analyzer"                # your clone of https://github.com/FoushWare/rtl-analyzer
RUN=/private/tmp/bilingual-storefront
rm -rf "$RUN" && mkdir -p "$RUN/reports" "$RUN/state/backups"
rsync -a --exclude node_modules --exclude dist --exclude .next --exclude .nx --exclude '*.tsbuildinfo' "$REPO/examples/bilingual-storefront/" "$RUN/project/"
cd "$RUN/project"
npm install
npm run check
rm -rf dist .next .nx
npm install --no-save --package-lock=false rtl-analyzer
npx --no-install playwright install chromium
npx rtl-analyzer scan --root "$PWD" --format dashboard --output-dir "$RUN/reports" --embed-source-snippets > /dev/null
git init -q && printf '.rtl-preview/\n.rtl-vite-cache/\n' >> .git/info/exclude && git add -A && git -c user.name=t -c user.email=t@t commit -qm baseline
```

Open the copy in VS Code (File → Open Folder → `/private/tmp/bilingual-storefront/project`, or `code /private/tmp/bilingual-storefront/project` if the `code` command is installed). Source Control stays empty until you apply a fix.

## 2. Run the app

```sh
# Terminal 2 - app (port 4245)
RUN=/private/tmp/bilingual-storefront
cd "$RUN/project"
npm run dev
```

Open <http://127.0.0.1:4245/?lang=ar>.

Press Ctrl-C to stop the app before the next step if you want a quiet machine; it uses a different port from Fix Studio (4246), so it can keep running.

## 3. Open Fix Studio

Fix Studio’s **review** actions are unsupported for this Next.js project (see [Limitations](#limitations)). You can still open the report dashboard to read findings and source. Terminal 4 is enough:

```sh
# Terminal 4 - report server (port 4320)
RUN=/private/tmp/bilingual-storefront
cd "$RUN/project"
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$RUN/reports"
```

Open <http://127.0.0.1:4320/rtl-report-dashboard.html>. Optionally also start the companion (Terminal 3 below) to see the *Runtime unavailable* message.

```sh
# Terminal 3 - review companion (port 4318)
RUN=/private/tmp/bilingual-storefront
cd "$RUN/project"
export RTL_PROJECT_ROOT="$PWD" RTL_REVIEW_STORE_PATH="$RUN/state/review-records-v1.json" \
  RTL_EVIDENCE_STORE_PATH="$RUN/state/review-evidence-v1.json" RTL_MANUAL_CHANGE_STORE_PATH="$RUN/state/manual-changes-v1.json" \
  RTL_SCAN_MANIFEST_STORE_PATH="$RUN/state/scan-manifests-v1.json" RTL_AUDIT_STORE_PATH="$RUN/state/apply-audit-v1.json" \
  RTL_APPLY_BACKUP_ROOT="$RUN/state/backups"
npx --no-install rtl-analyzer preview
```

Ports: 4318 (companion), 4320 (report), 4246 (original app for Fix Studio), 4202 and up (candidates).

## 4. Start here

- **Route / URL:** `http://127.0.0.1:4245/?lang=ar` (RTL) and `?lang=en` (LTR). Also `&drawer=open`, `&page=1|2`.
- **Finding:** `RTL.CSS.PHYSICAL` on **`.cart-count`** in `app/storefront.css` (`margin-left: 6px`). Select the file in the Project Explorer on the left, then the finding.

What you should see:

- Static page: the cart count badge trails the “Cart” label with a 6 px gap. **Before** (LTR and RTL): computed `margin-left: 6px`, `margin-right: 0`. In Arabic the badge therefore sits on the wrong side of the gap.
- There is no verified **After**: the live After pane reports *Runtime unavailable*.
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
RUN=/private/tmp/bilingual-storefront
rm -rf "$RUN/state" && mkdir -p "$RUN/state/backups"
cd "$RUN/project" && git checkout -- . && git clean -fdq -e node_modules
```

To start completely over, rerun step 1 (it deletes and recreates the copy). Rollback is refused if you edit a file after applying; reset instead.

## Limitations

- **Windows is not supported in v0.5.0**. Safari, other browsers, other package managers and narrow viewports are unverified.
- **Next.js live preview is unsupported.** Starting a review shows *Preview preparation failed: Runtime unavailable*; Validate, Apply and Rollback cannot be exercised, and batch mode cannot prepare a candidate. Use this project for the static scan and for reading findings and source.
- Tailwind utility findings are detection-only; `RTL.BIDI.ISOLATION` and the drawer are manual.
- Live review needs Chromium and trusted project scripts. Details: [advanced setup guide](../../docs/guides/developer-testing.md).

## Verified

Checked on 2026-11-22 (macOS arm64, Node 22.21.1, headless Chromium driven by Playwright). The 0.4.0 run used the commands in the blocks above with `rtl-analyzer@0.4.0` pinned in place of the versionless command, unchanged apart from `REPO`, in a fresh `/private/tmp/bilingual-storefront` copy against the published `rtl-analyzer@0.4.0`. It has not been re-run against `rtl-analyzer@0.5.0-rc.1`.

Scan step against the published `rtl-analyzer@0.5.0-rc.1` (2026-11-23): **passed** (exit 0, dashboard produced, 8 findings). Live Preview, Fix Studio, Apply and Rollback against `0.5.0-rc.1`: **not verified**. Results: setup, `npm run check` and the scan succeeded; the app responded at `?lang=en` and `?lang=ar` and the `.cart-count` margins above were measured there. The companion and report server started and the dashboard lists the findings. Starting a review on `.cart-count` failed with *Preview preparation failed: Runtime unavailable* as documented, so Validate, Apply, Rollback and batch were **not** exercised (unsupported). `all ports free`; Reset clean. **Not verified:** the other seven findings in the dashboard UI.

Earlier notes from building this example are kept in [the verification history](../../docs/verification/examples-history/bilingual-storefront.md); they predate 0.4.0.

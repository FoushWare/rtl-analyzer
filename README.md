# RTL Analyzer

Find direction-dependent styles, inspect suggested fixes, and review changes for RTL and LTR interfaces.

[Quick start](#quick-start) · [Workflow](#how-a-review-works) · [Example projects](#example-projects) · [Limits](#what-is-and-is-not-covered) · [Advanced setup guide](https://github.com/FoushWare/rtl-analyzer/blob/v0.4.0/docs/guides/developer-testing.md)

## Quick start

Requires **Node.js 22.12 or later**. Run from your frontend project's root:

```sh
npx rtl-analyzer@0.4.0
```

The command scans the current directory, writes reports to an external temporary directory and opens the report in your default browser. It does not start the live review services. For a scan of one directory, or command help:

```sh
npx rtl-analyzer@0.4.0 scan ./src --format json
npx rtl-analyzer@0.4.0 --help
```

A read-only scan needs no configuration. **Live Fix Studio review does need configuration**: explicit scan and copy scope, validation scripts, source-to-page bindings, your project's installed dependencies and Chromium. The [advanced setup guide](https://github.com/FoushWare/rtl-analyzer/blob/v0.4.0/docs/guides/developer-testing.md) covers it. To try the whole flow first, use one of the [example projects](#example-projects).

## How a review works

The screenshots below come from the released package running on the Workspace Integration example: a shared badge whose `margin-left: 8px` should follow the text direction.

### 1. Run the scan and open Fix Studio

Scan with a dashboard report and embedded source snippets, serve the report, and start the review companion. The dashboard reports the scan result and the number of findings.

![RTL Analyzer dashboard header after a completed scan: "Scan complete, analyzed 15 files, 2 findings".](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/00-scan-complete.png)

### 2. Choose a review mode

**Prepare all, then review** prepares every eligible change in one isolated candidate so you can review them together. **Review one by one** prepares only the finding you are looking at. Both modes start with every decision **Pending**, and neither changes your source.

![Fix Studio's review-mode chooser with the two options "Prepare all, then review" and "Review one by one".](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/01-choose-review-mode.png)

### 3. Find the finding in your code and on the page

Each finding shows its highlighted source line and why it was flagged. For findings with a configured page binding, **Highlight targets** outlines the affected element in the running page.

![A finding open in Fix Studio: the highlighted line "margin-left: 8px;" in the stylesheet, the rule explanation, and the highlighted element in the rendered page.](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/02-locate-finding.png)

### 4. Compare Before and After

The code card shows the original declaration next to the suggested one. The live panes render the original application (Before) and an isolated copy with the change (After). Switch between **LTR** and **RTL**, and between apps when a finding is bound to more than one. In one-by-one mode, After shows only the finding you selected.

![Before and After live panes side by side in RTL, with the badge outlined in both.](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/03-before-after.png)

### 5. Make a decision

Choose **Approve proposed change**, **Reject fix**, **Defer** or **Needs review**. Approving adds the change to your accepted set. Your project files still have not changed.

![Confirmation after approving a change: "Added to your accepted changes. Your project files have not changed."](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/04-decision.png)

### 6. Validate the accepted changes

**Validate changes** runs your configured checks, and a scoped LTR/RTL runtime check, against a candidate that contains only the accepted changes.

![Dialog "Validation passed: 1 changes validated. Your original source files have not changed."](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/05-validate.png)

### 7. Apply to source, explicitly

Applying is a separate step. The confirmation names the destination project and every file that will be written. Rejected, deferred and unaccepted findings are excluded, and Apply creates receipt-backed backups.

![The "Apply changes to source" confirmation listing the destination project and the affected file.](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/06-apply-confirmation.png)

Afterwards, check your diff and the interface in both directions.

![Fix Studio after Apply, with the accepted change recorded as applied.](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/07-applied.png)

### 8. Roll back if needed

**Review actions → Rollback applied changes** restores the files from the receipt. Rollback is refused if you edited the files after Apply, so it never overwrites your later work.

![The Review actions menu showing "Rollback applied changes".](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/08-rollback.png)

### Batch mode: prepare eligible changes, then approve selected ones

In **Prepare all, then review**, the batch overview lists every change that could be prepared. Nothing is approved automatically. Select the rows you want, **Approve selected**, then **Validate** and apply as above. Preparing a batch never writes to your source; applying it requires the same explicit confirmation. Use **View diff** to inspect any row.

![Batch review overview with two prepared fixes, a row checkbox for each, and the buttons Select all prepared, Approve selected and Validate.](https://raw.githubusercontent.com/FoushWare/rtl-analyzer/v0.4.0/docs/images/readme/09-batch-review.png)

If your source or your decisions change during a review, freshness checks can invalidate a suggestion or a validation. Failed or unavailable required evidence blocks Apply.

## What is and is not covered

Verified in this release (macOS, Chromium, desktop width):

- **Suggested fixes and live Before/After** for literal physical `margin-*`, `padding-*` and `text-align` in simple class rules of stylesheets you declare as `custom-css`, and for other declarations (borders, offsets, transforms) you declare yourself in `cssProposals` ([CSS proposal setup](https://github.com/FoushWare/rtl-analyzer/blob/v0.4.0/docs/guides/css-proposal-setup.md)).
- **Findings without a safe automatic fix** (for example fixed-edge positioning, ordering, transforms) are reported with an explanation and marked for manual review; you still get the Before view.
- **Detection only:** recognized utility classes and bounded SCSS declarations.
- **Live preview** supports Vite-compatible development scripts, including an Nx workspace that runs Vite. Next.js apps can be scanned statically, but live preview is not supported.
- **Not detected:** JavaScript key handling, focus order and other behavior that is not expressed in styles.

A scan reports potential issues; it does not prove a page renders correctly. **Windows is not supported in v0.5.0.** The one-command dashboard and `--output-dir` report output are refused on Windows with `unsupported platform/filesystem profile` and exit code 2; nothing is written, and existing report files are left unchanged. Source snippets fail closed (`UNSUPPORTED_NOFOLLOW`) on Windows, so findings show as unavailable. Because the review workflow starts from the dashboard, it is not reachable through the packaged CLI on Windows in this release. Validation commands run only with npm on Windows; pnpm and yarn are refused. Windows support is planned for v0.6.0. Report publication and protected source operations use a trusted POSIX filesystem profile (macOS and Linux). Safari, package managers other than npm and general framework compatibility are not certified. Project scripts must be trusted.

## Example projects

Six runnable projects live in the repository under [`examples/`](https://github.com/FoushWare/rtl-analyzer/tree/v0.4.0/examples). They are not part of the npm package. Copy one to a temporary folder before you apply anything.

| Project | What it shows |
| --- | --- |
| [Foundations Lab](https://github.com/FoushWare/rtl-analyzer/tree/v0.4.0/examples/foundations-lab) | Direction, spacing, edges, transforms in a Vite app |
| [Account Checkout](https://github.com/FoushWare/rtl-analyzer/tree/v0.4.0/examples/account-checkout) | Two supported fixes, one manual-review case, clean controls |
| [Admin Dashboard](https://github.com/FoushWare/rtl-analyzer/tree/v0.4.0/examples/admin-dashboard) | Tables, dialog and tabs; several manual-review findings |
| [Bilingual Storefront](https://github.com/FoushWare/rtl-analyzer/tree/v0.4.0/examples/bilingual-storefront) | Next.js and Tailwind; static scan only |
| [Interaction Playground](https://github.com/FoushWare/rtl-analyzer/tree/v0.4.0/examples/interaction-playground) | Drawer, rating and slider; scanner finds CSS risks, not key handling |
| [Workspace Integration](https://github.com/FoushWare/rtl-analyzer/tree/v0.4.0/examples/workspace-integration) | Nx workspace, two apps and a shared library |

Each project's README has its setup instructions and expected findings. The [hands-on testing guide](https://github.com/FoushWare/rtl-analyzer/blob/v0.4.0/docs/guides/example-testing-guide.md) walks through all six.

## Development

The public package bundles a pinned implementation at build time. Consumers install `rtl-analyzer`; the internal `@atlas/rtl-scanner` package is private. Clone with submodules and follow the [build, pack and verification commands](https://github.com/FoushWare/rtl-analyzer/blob/v0.4.0/docs/guides/developer-testing.md#build-pack-and-verify). Licensed under [MIT](https://github.com/FoushWare/rtl-analyzer/blob/v0.4.0/packages/rtl-analyzer/LICENSE).

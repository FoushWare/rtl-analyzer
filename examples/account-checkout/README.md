# Account checkout (example project 2)

React + Vite + CSS Modules checkout with four intentional cases (see `manifest.json`):

| ID | Rule target | Expected |
|---|---|---|
| ATC-FIX-01 | `.editLink` `margin-left` | supported candidate `margin-inline-start` |
| ATC-FIX-02 | `.couponHint` `text-align: left` | supported candidate `text-align: start` |
| ATC-REVIEW-01 | `.secureBadge` `right: 12px` | finding, no candidate; needs a human decision (fixed trust position vs follows inline-end) |
| ATC-OK-01 | `.payment`, `.cardNumber`, `.totalRow` | no finding |

Other scan output (`RTL.DOCUMENT.INITIAL`, `RTL.RUNTIME.DIRECTION_UNKNOWN` in `App.jsx`) is diagnostic, not a case result. Direction is switched with the select or `?direction=ltr|rtl`.

`vite.config.mjs` sets `css.modules.generateScopedName: '[local]'` so source selectors equal DOM selectors for live preview. Without it, hashed class names break the mapping.

## Run

```sh
npm install
npm run build      # validation build
npm run dev        # http://127.0.0.1:4225/?direction=rtl
```

To scan, install a built `rtl-analyzer` package into a disposable copy (see [Reproduce](../../docs/handoffs/claude/REPRODUCE.md)); run `npx --no-install rtl-analyzer scan --root "$PWD" --format dashboard --output-dir ../reports --embed-source-snippets`. Apply and rollback only on a disposable copy. The Analyzer creates `.rtl-preview/` and `.rtl-vite-cache/` inside the project during live review; both are gitignored. Human acceptance is unchecked.

## Troubleshooting: first After preview fails

On a fresh copy, the first After preview can fail with `Preview preparation failed: page.evaluate: Execution context was destroyed, most likely because of a navigation`. Vite reloads the candidate page once while it optimizes dependencies for the first time. Retrying immediately failed repeatedly in our run.

Verified locally (one fresh disposable copy, Analyzer built from implementation `54648af`); not tested elsewhere:

1. Find the candidate URL: it is the second (After) preview frame's address, for example `http://127.0.0.1:4202/?direction=ltr`. In the browser dev tools, inspect the After `iframe` `src`. Candidate ports are allocated by the Companion, so use the one shown.
2. Open that URL in a separate browser tab and wait until the checkout page renders; this lets Vite finish dependency optimization. Close the tab.
3. Return to the dashboard and select **Retry preview**. The After panel should then show "Preview ready". If the first retry still fails, repeat once.

The workaround changes no project source files.

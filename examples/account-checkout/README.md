# Account checkout (example project 2)

React + Vite + CSS Modules checkout with three intentional cases (see `manifest.json`): a supported spacing fix (`.editLink`), a manual-review case (`.couponHint`) and a correct logical-CSS control that should produce no finding. Direction is switched with the select or `?direction=ltr|rtl`.

`vite.config.mjs` sets `css.modules.generateScopedName: '[local]'` so source selectors equal DOM selectors for live preview. Without it, hashed class names break the mapping.

## Run

```sh
npm install
npm run build      # validation build
npm run dev        # http://127.0.0.1:4225/?direction=rtl
```

To scan, install a built `rtl-analyzer` package into a disposable copy (see [Reproduce](../../docs/handoffs/claude/REPRODUCE.md)); run `npx --no-install rtl-analyzer scan --root "$PWD" --format dashboard --output-dir ../reports --embed-source-snippets`. Apply and rollback only on a disposable copy. Human acceptance is unchecked; analyzer results are not yet recorded.

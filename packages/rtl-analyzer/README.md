# RTL Analyzer CLI

Standalone CLI packaging for RTL Analyzer. The CLI performs read-only RTL risk scans and can emit JSON, Markdown, structured Markdown, or a self-contained dashboard HTML report.

## Build and pack

From a fresh checkout, install the repository dependencies, then build and pack the standalone package:

```bash
npm ci
npm run build --prefix packages/rtl-analyzer
cd packages/rtl-analyzer
npm pack --dry-run
npm pack
```

The package `prepack` hook rebuilds `dist/` automatically, so packing cannot silently use a missing or stale CLI build. The tarball contains only the compiled scanner/reporting runtime, this README, and the MIT license.

## Confirmed syntax coverage

The standalone CLI supports the following tested patterns. These are syntax-level results, not claims of complete framework compatibility:

| Area | Status | Tested scope |
| --- | --- | --- |
| React inline JSX/TSX styles | Verified | Static object properties including physical margins, padding, and text alignment. |
| Emotion `styled` templates | Verified | Static tagged templates imported from `@emotion/styled`. |
| Emotion `css` prop | Verified | `@emotion/react` tagged templates and static object expressions. |
| MUI `sx` | Partial | Supported MUI imports and aliases such as `ml` and `pr`; wrapper semantics remain conservative. |
| MUI `styled` templates | Verified | Static tagged templates imported from `@mui/material/styles`. |
| Vanilla CSS/HTML | Verified | Tested physical declarations and HTML direction attributes. |
| CSS Modules | Verified | Physical declarations in discovered `.module.css` files. |
| Tailwind utilities | Partial | Static class strings recognize `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `border-l-*`, `border-r-*`, `text-left`, `text-right`, and identifiable `rtl:`/`ltr:` variants. Dynamic composition is not evaluated. |
| Bootstrap 4 directional utilities | Partial | Static class strings recognize Bootstrap 4 `float-left/right`, responsive `float-{sm,md,lg,xl}-left/right`, `text-{sm,md,lg,xl}-left/right`, and `border-left/right[-0]`. Shared physical classes such as `ml-*` remain framework-neutral; Bootstrap version and runtime semantics are not inferred. |
| SCSS/Sass | Unsupported with diagnostic | Files are skipped and reported through `SOURCE_COVERAGE`. |

MUI `styled` object syntax is unsupported. Tailwind responsive/state prefixes and arbitrary values are covered only when the final utility is statically identifiable; dynamic `clsx`, `classnames`, and template expressions are intentionally not guessed. Next.js `app/`, `src/app/`, `pages/`, and `src/pages/` layouts can be discovered as ordinary files, but this does not certify Next.js-specific behavior.

Bootstrap support is limited to the listed Bootstrap 4 physical utility forms. Bootstrap 5 logical utilities such as `ms-*`, `me-*`, `ps-*`, and `pe-*`, custom classes, project configuration, and dynamic class composition are not interpreted.

To verify the tarball in an independent disposable project:

```bash
npm run rtl:cli:package:smoke
```

The smoke test installs with `npm install --ignore-scripts`, checks `--help` and `--version`, scans a disposable project in JSON, Markdown, and Dashboard formats, and checks that installed files contain no source-checkout paths.

```bash
npm install rtl-analyzer
rtl-analyzer --help
rtl-analyzer scan . --format json
```

Candidate Preview and Apply/Rollback are not included in this standalone CLI milestone.

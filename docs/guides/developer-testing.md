# Developer testing and configured review

Maintained setup for `rtl-analyzer` 0.5.0. Read-only scans work without a preview configuration; live review requires the explicit project/runtime setup below. Use a disposable copy for first source-Apply testing.

## Commands and standalone configuration

```sh
npx rtl-analyzer --help
npx rtl-analyzer --version
npx rtl-analyzer scan . --format json
npx rtl-analyzer preview --help
```

`rtl-scanner` and `rtl-preview` are also installed as direct aliases. The consumer workflow uses the `rtl-analyzer` router. Generic recursive scans need no configuration. An explicit project configuration takes precedence; existing flat Nx discovery remains supported. Utility findings are detection-only, one finding per recognized static token; IDs/counts can differ from older reports. Static React inline styles, Emotion css/styled, MUI sx/styled, HTML/CSS and CSS Modules are analyzed conservatively. Static SCSS declarations are detected; imports/interpolation/mixins remain incomplete and SCSS repair is unsupported. No framework-wide compatibility is certified.

Formats: `json`, `markdown`, `markdown-structured`, `dashboard`. Exit 0 means complete analysis; findings alone do not fail. `--fail-on-findings` selects exit 1 for actionable findings. Incomplete analysis/configuration errors exit 2 and take precedence. For standalone review, declare scan/copy scope and real project checks in `rtl-project.config.json` (paths must exist):

```json
{
  "schemaVersion": 1,
  "scanRoots": ["src", "index.html"],
  "copyPaths": ["src", "index.html", "vite.config.ts", "tsconfig.json", "package.json", "package-lock.json", "tests"],
  "packageManager": "npm",
  "validation": {
    "typecheck": ["run", "typecheck"],
    "build": ["run", "build"],
    "test": ["run", "test"]
  }
}
```

Declare only real paths/scripts. `copyPaths` must include each scan root and everything the candidate's dev/build/check commands need. The original project's installed dependencies are shared with the disposable candidate. Supported package-manager identifiers are npm, pnpm and yarn; this release smoke exercises npm. Configured commands execute in the isolated project and must be trusted. Missing/unconfigured checks are reported distinctly; they do not prove project-wide coverage. Test coverage remains Unknown.

Reports require an **already existing external directory outside the scanned project**, with no symlink ancestors. Existing filenames are never overwritten. Use a new directory for each scan. This example creates a sibling temporary report directory:

```sh
REPORT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rtl-report.XXXXXX")"
REPORT_DIR="$(cd "$REPORT_DIR" && pwd -P)"
npx --no-install rtl-analyzer scan --root . --format dashboard \
  --embed-source-snippets --output-dir "$REPORT_DIR" > /dev/null
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$REPORT_DIR"
```

Open [the local dashboard](http://127.0.0.1:4320/rtl-report-dashboard.html). Four artifacts are generated: JSON, legacy Markdown, structured Markdown and HTML. The dashboard bundles its own CSS/JavaScript; it needs no separate asset server or CDN. Embedded source is opt-in and may contain sensitive data. Static browsing works without the companion; review mutations and live application previews require the services below.

## Live preview and review prerequisites

The current standalone adapter supports **Vite-compatible development scripts**, explicit source/selector/route bindings and real LTR/RTL document direction. Install your project's own React/Vite dependencies and have a dev script such as `"dev": "vite"`. There is no general Next.js or mocking adapter and no automatic route discovery. Configure `rtl-preview.config.json`; this example binds a declaration in `src/reading.css` to an actual `.contact-card` element rendered by `src/main.tsx`:

```json
{
  "schemaVersion": 1,
  "applications": {
    "consumer": {
      "viteConfig": "vite.config.ts",
      "entry": "src/main.tsx",
      "originalOrigin": "http://127.0.0.1:4215",
      "readySelector": "#root main article",
      "dataAdapter": "none",
      "startupScript": "dev",
      "routes": [{
        "id": "people", "path": "/people",
        "ltr": "/people?direction=ltr", "rtl": "/people?direction=rtl"
      }]
    }
  },
  "mappings": [{
    "source": "src/reading.css", "sourceSelector": ".contact-card",
    "targetSelector": ".contact-card",
    "routes": [{"application": "consumer", "route": "people"}]
  }]
}
```

The application must actually implement those URLs and set `document.documentElement.dir` accordingly. `dataAdapter: "none"` uses application data and makes no dataset-equivalence guarantee. Each accepted finding needs a valid mapping and runtime target to pass final validation. Unmapped sources remain available for code review and expose an Unavailable limitation; a route declaration alone is not verification.

In another terminal, from the installed project's root:

```sh
npx --no-install playwright install chromium
RTL_PROJECT_ROOT="$PWD" npx --no-install rtl-analyzer preview
```

Python 3 serves the dashboard at **127.0.0.1:4320**; the companion listens at **127.0.0.1:4318**. Configured original runtimes use their declared loopback port; isolated candidate runtimes use **4202–4212**. These ports must be free; the analyzer does not stop unrelated owners. Chromium is required for technical runtime validation, not for read-only scans. The companion starts supported original/candidate Vite runtimes when needed. Stop it with Ctrl-C to stop its owned runtimes. Generated `.rtl-preview/` configs and `.rtl-vite-cache/` caches belong to the target's local development state and should be ignored by Git.

Default records, evidence and workflow state live under `~/.rtl-migration-analyzer`; controlled-Apply backups default to `rtl-migration-analyzer-apply-backups` under the OS temporary directory. For disposable testing, create a fresh external state directory and set these variables (the first two basenames are required by the store guards):

| Variable | Path inside your external state directory |
| --- | --- |
| `RTL_REVIEW_STORE_PATH` | `review-records-v1.json` |
| `RTL_EVIDENCE_STORE_PATH` | `review-evidence-v1.json` |
| `RTL_MANUAL_CHANGE_STORE_PATH` | `manual-changes-v1.json` |
| `RTL_SCAN_MANIFEST_STORE_PATH` | `scan-manifests-v1.json` |
| `RTL_AUDIT_STORE_PATH` | `apply-audit-v1.json` |
| `RTL_APPLY_BACKUP_ROOT` | `backups/` directory |

Keep all six overrides together to isolate release tests. Keep backups for rollback; do not include state or reports in your package.

## Workflow and safety contract

- **Review one by one** prepares the selected supported proposal in isolation. **Prepare all, then review** prepares the supported inventory together (`apply-first` remains the persisted identifier). Both start Pending and never implicitly approve source changes.
- Inspect original/candidate previews with matching route/direction/viewport, exact source, explanations and limitations. Supported proposals remain bounded CSS spacing/alignment/insets/borders/corners, direct React inline styles, explicitly marked progression icons and direct supported bidi text sinks; semantic approval is always required. Dynamic/ambiguous/processor-owned cases remain blockers.
- Approve, reject, defer or flag findings. **Validate changes** recomposes the candidate from accepted entries only and runs the declared project checks, scanner and mapped runtime checks. Changing the accepted snapshot invalidates validation. Failed/Unavailable required evidence blocks source Apply.
- **Apply … accepted changes to source** is a separate confirmation. Source/config hashes, trusted paths, exact candidate evidence and receipts/backups guard the write. Pending/rejected/deferred changes do not reach source.
- **Review actions → Rollback applied changes** restores only receipt-backed writes and refuses conflicting later edits. After rollback/rescan a fresh Pending / Not run review starts; history and receipts stay separate. After Apply, immutable historical Before runtime is unavailable; current source is labeled separately.
- **Session details** exposes Activity, Validation, Changes and Technical evidence with separate history. Saved notes persist; unsaved per-finding drafts last only for the current page session. Target restoration requires a unique verified identity; lost/ambiguous targets require explicit reselection. Files/Findings controls, direction and fullscreen reuse the live preview state.

Trusted project roots and ancestors must be protected against hostile concurrent replacement; symlink/path/hash guards are not a sandbox for untrusted project scripts. Static risk evidence cannot prove a universal computed cascade or certify arbitrary frameworks/browsers. Chromium is automated here; Safari certification and an existing real-world project acceptance remain pending. Ahmed's personal acceptance is not implied by test results.


## Build, pack and verify

This existing public package bundles the pinned Analyzer implementation at build time. Consumers do not clone a repository, download source, or install `@atlas/rtl-scanner`. That internal manifest is private.

```sh
git clone --recurse-submodules https://github.com/FoushWare/rtl-analyzer.git
cd rtl-analyzer
git submodule update --init
npm ci
npm run rtl:scan:typecheck
npm run rtl:scan:test
npm run rtl:cli:package:smoke
```

For a published release checkout, select `v0.5.0` before updating submodules. The smoke command builds/packs, installs the tarball outside both repositories and exercises the wrapper's scan/preview routes, both review modes, accepted-only Apply and exact rollback. It requires free test ports, Python 3 and installed Chromium (`npx playwright install chromium`). The implementation pin and source lineage are recorded in package metadata; `prepack` refuses a mismatched or modified implementation and removes stale generated modules.

Only `dist/*.js`, the package README, package metadata and the MIT license enter npm. Examples, source, tests, videos, reports, backups, local state, credentials and dependencies stay outside the tarball. The repository root is private. Development uses a Git submodule to avoid maintaining a copied second implementation.

Report publication and protected source operations use the trusted POSIX filesystem profile. The installed wrapper journey passes on macOS and Linux with Chromium/npm. Windows CI fails on unsupported POSIX/path behavior, and protected Windows operations remain unsupported. Safari, other package managers and an existing real-world project acceptance are not certified. A scan is read-only; generated reports embed source only when `--embed-source-snippets` is requested.

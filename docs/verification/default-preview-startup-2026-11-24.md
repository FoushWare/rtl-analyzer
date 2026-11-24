# Default Live Preview startup (v0.6.0 candidate) — verification record

**Verified 2026-11-24 on macOS (Node 22.21.1), packaged candidate `rtl-analyzer@0.6.0` built from `feat/default-preview-startup`.** Implementation pin unchanged (`819b733`). The pinned submodule was not modified.

## What the release changes

- In an interactive terminal, `npx rtl-analyzer` starts the project's dev server named by `rtl-preview.config.json` without `--approve-project-scripts`.
- Before the server starts, a read-only preflight checks the executable the startup script needs. A missing dependency gives "Live Preview needs setup" with the project path, the package manager, and the install command. Nothing is installed.
- The startup notice is printed only after the preflight passes, immediately before the dev server starts. Retry Preview repeats the same order.
- Non-interactive runs (no terminal) still require `--approve-project-scripts`. Without it, the static report is produced.
- `--no-project-scripts` disables project scripts.

Child-process stderr capture is **not** in this release. It needs a change to the pinned implementation and is deferred.

## Verified facts (this run)

| Check | Result |
| --- | --- |
| Scanner typecheck (`npm run rtl:scan:typecheck`) | pass |
| Pinned scanner suite (`npm run rtl:scan:test`) | 524/524 pass |
| Overlay suite (`npm run rtl:overlay:test`) | 442/442 pass |
| Package build (`npm --prefix packages/rtl-analyzer run build`) | pass |
| Consumer smoke (`npm run rtl:cli:package:smoke`) | pass (`Passed`, exit 0) |
| `git diff --check` | clean |
| Fresh copy, no `node_modules`, default command in a pseudo-terminal | `PREVIEW_DEPENDENCIES_MISSING`; setup dialog shown; no notice printed; no companion or original app started |
| Retry Preview after `npm ci` | status `ready`; original app HTTP 200 on 4216 |
| Installed copy, default command in a pseudo-terminal, no flag | dashboard, Live Preview, Live Before/After (`margin-left:auto` → `margin-inline-start:auto`), Fix Studio |
| Approve → Validate → Apply → Rollback | Validate passed; Apply changed only `src/lab.css`; rollback restored the pre-Apply SHA-256 exactly (`929268f3…`); audit has APPLIED and ROLLED_BACK for the run's auditId |
| `--no-project-scripts` in a pseudo-terminal | notice printed; nothing started on 4216, 4318, 4320 |
| Non-interactive default, no flag | declined with the approval-required message; nothing started |
| Non-interactive `--approve-project-scripts` | ready; original app HTTP 200 (backward compatibility) |

## Regression baseline (origin/main)

Exported `origin/main` with `git archive` and populated the pinned implementation at `819b733`:

- Pinned suite run from the implementation directory (the way `rtl:scan:test` runs): 524/524 pass.
- Overlay suite: 421/421 pass. This branch adds 21 overlay tests (442 total). No test that passes on `origin/main` fails here.

Running the pinned suite from the repository root instead of the implementation directory produces two `policy-historical` failures, because that test reads a file relative to the working directory. That is a harness-direction artifact, not a regression.

## Known pre-existing failures (not caused by this release)

- Root `npm run typecheck` fails with five TS7016 errors. The Playwright configs and `tests/e2e` import `.mjs` fixtures without declaration files. Same five errors on `origin/main`.
- Root `npm run build` (Nx) fails at project-graph load. Projects such as `invoicing`, `procurement`, `rtl-scanner`, `design-system`, and `shared` are defined under both the root tree and `implementation/`. Same failure on `origin/main`.

Neither command runs in `ci.yml` or `publish.yml`.

## Harness notes

- The browser tool cancels native `window.confirm`. The rollback step in the browser run used a test-only override that returns true, as in the earlier E2E. The app's own checks still ran; the audit log and exact hash restoration are the evidence.
- Some runs used a pseudo-terminal (`script`) so that the CLI is interactive, as a user's terminal would be.

## Limitations

- Child-process stderr is not captured. A failed dev server gives an actionable hint to run the script yourself, but not the error text.
- The dependency check covers the startup script's executable (and `vite` when no startup script is set). It does not verify every imported package.
- Yarn Plug'n'Play is not checked.

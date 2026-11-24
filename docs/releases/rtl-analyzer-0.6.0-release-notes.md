# RTL Analyzer 0.6.0 — release notes

## One command for Live Before/After

- In an interactive terminal, `npx rtl-analyzer` starts your project's development server automatically when the project ships an `rtl-preview.config.json`. The `--approve-project-scripts` flag is no longer needed there.
- In non-interactive runs (scripts, CI, pipes), project scripts still need `--approve-project-scripts`. Without it, the static report is produced and Live Preview is not started.
- Opt out with `npx rtl-analyzer --no-project-scripts`. The static report is still produced, and no project script runs.

## Dependencies are checked before anything starts

- Before the dev server starts, RTL Analyzer checks that the executable the startup script needs (for example `vite` or `nx`) is installed. It checks `node_modules` in the project and in parent folders, so hoisted monorepo installs work. Yarn Plug'n'Play is not checked.
- If a dependency is missing, the dashboard shows **Live Preview needs setup** with the project path, the package manager, and the install command (`npm ci` when a `package-lock.json` exists, otherwise `npm install`; `pnpm install --frozen-lockfile`; `yarn install`; `bun install`).
- RTL Analyzer never installs packages and never changes a lockfile. Install the dependencies yourself, then choose **Retry Preview**. The check runs again on every attempt.

## Clearer startup failures

- A port that another process holds is reported as a conflict. RTL Analyzer does not stop that process.
- A dev server that exits or does not respond says so, and tells you to run the project's dev script yourself to see its error output.

## Security: project scripts run by default

Live Before/After runs the one dev script named by `rtl-preview.config.json`, in the project root. This is the same code as `npm run dev`.

- Run `npx rtl-analyzer` only in projects you trust.
- Projects without `rtl-preview.config.json` never have a script run.
- Before starting, RTL Analyzer prints the exact command it will run.
- Use `--no-project-scripts` to turn this off.

## Known limitations

- The child process's stderr is still not captured. The companion starts the dev server and discards its output, so the failure message can point you to running the script yourself, but it cannot quote the error. Capturing it needs a change to the pinned implementation and is planned as follow-up work.
- The dependency check covers the executable named in the startup script and the `vite` executable when there is no startup script. It does not check every package the project imports.
- The package manager used to start the dev server still comes from `rtl-project.config.json` (default `npm`). The install suggestion uses the lockfile and the `packageManager` field.
- Windows is still not supported for protected operations in this release (see v0.5.0 notes). Issue #28 (Windows publication) is not part of this release.

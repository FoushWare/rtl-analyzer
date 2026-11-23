# RTL Analyzer 0.5.0 — release notes (draft)

## Platform support

- **macOS and Linux:** the full supported workflow: scan, dashboard, live preview, batch and per-finding review, validation, Apply and rollback.
- **Windows: not supported in v0.5.0.** Windows support is planned for v0.6.0.

Windows limitations in this release, and what you will see:

- **Dashboard and report output are refused.** `rtl-analyzer` (the one-command run), `--format dashboard`, and any `--output-dir` report output fail with `unsupported platform/filesystem profile` and exit code 2. Nothing is written, and existing report files are left unchanged. Stdout-only `json` and `markdown` output still works.
- **Source snippets fail closed.** Windows has no `O_NOFOLLOW`, so snippet reads return `UNSUPPORTED_NOFOLLOW`. Findings are listed as unavailable, and no source text is shown.
- **The review workflow is not reachable on Windows.** It starts from the dashboard, which is refused, so Apply and rollback are not available through the packaged CLI.
- **Validation commands:** npm checks run through npm's own CLI with Node, with no shell. pnpm and yarn validation commands are refused on Windows.

These fail-closed behaviors are deliberate. They are not bypassed or skipped for Windows.

## What CI verifies

- Ubuntu: full consumer workflow, including the packaged dashboard, live preview and review checks.
- Windows: the packaged consumer smoke test verifies the refusal contract above, including exit code 2, the error message, that no artifacts are created, and that an existing report file is unchanged.

## Known limitations

- Windows full support (secure report publication, source snippets, NTFS verification, and end-to-end testing on a real Windows machine) is planned for v0.6.0.
- Projects must be trusted: project scripts run as the user.

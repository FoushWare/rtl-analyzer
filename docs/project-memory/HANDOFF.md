# Windows handoff

Updated 2026-11-11 after verifying the macOS workspace.

- Repository: `https://github.com/FoushWare/rtl-analyzer.git`
- Branch: `feat/standalone-cli-packaging`
- Source: local macOS development workspace (path intentionally omitted from publishable memory)
- HEAD: `83037e013469f0de513f062347ad9285816f7a95`
- Working tree: modified tracked package/docs/scanner files and untracked standalone source/tests/fixtures plus `packages/`, `dist/`, `node_modules/`, and `test-results/`. Generated directories are excluded from the snapshot; source and tests are included.
- Latest milestone: M4D.2b complete. Current handoff verification: scanner typecheck/build passed; targeted generic/security/crash/proposal tests 54/54; standalone package smoke passed with a 31-file tarball. Pending: M4D.3.
- Snapshot: `~/Documents/RTL-Analyzer-Handoff/rtl-analyzer-m4d2b-source-20261111.zip`, with `MANIFEST-20261111.sha256`, `INCLUSION-LIST-20261111.txt`, and extracted verification copy.

Required files include `tools/rtl-scanner/src/generic-multi-file-transaction.ts`, `generic-multi-file-recovery.ts`, `tests/generic-three-file-crash.test.ts`, and `tests/fixtures/generic-crash-worker.mjs`, plus all included source, tests, manifests, lockfile, and project memory.

## Safe import and next action

Extract to a new directory, verify SHA-256 manifest and inclusion/exclusion inventory, then read `WINDOWS-VERIFICATION.md` and execute M4D.3 on Windows. Do not overwrite an existing tree or copy `dist`, `node_modules`, or test results.

## Restrictions/blockers

Do not commit, push, tag, publish, upload, reset, clean, stash, or delete the original workspace. No credentials or secrets belong in the snapshot. Windows filesystem and crash/restart behavior remain unverified; process-crash evidence is not power-loss evidence.

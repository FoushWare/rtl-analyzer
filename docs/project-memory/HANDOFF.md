# Windows handoff

Updated 2026-11-12 after Native Windows verification.

- Repository: `https://github.com/FoushWare/rtl-analyzer.git`
- Branch: `feat/standalone-cli-packaging`
- Source: local macOS development workspace (path intentionally omitted from publishable memory)
- HEAD: `83037e013469f0de513f062347ad9285816f7a95`
- Working tree: modified tracked package/docs/scanner files and untracked standalone source/tests/fixtures plus `packages/`, `dist/`, `node_modules/`, and `test-results/`. Generated directories are excluded from the snapshot; source and tests are included.
- Latest milestone: M4D.4T Windows verification complete. Native Windows verification recorded the full scanner suite at 309 passed, 59 skipped, 0 failed across 32 test files; the exact successful command record was `npm run rtl:scan:test` (suite), `npm run rtl:scan:build` (TypeScript build), and `npm run rtl:cli:package:smoke` (standalone package smoke, 31 tarball files). The smoke internally completed JSON, Markdown, and Dashboard scans. Windows secure-access contract passed 9/9; output architecture passed 8/8.
- Snapshot: `~/Documents/RTL-Analyzer-Handoff/rtl-analyzer-m4d2b-source-20261111.zip`, with `MANIFEST-20261111.sha256`, `INCLUSION-LIST-20261111.txt`, and extracted verification copy.

Required files include `tools/rtl-scanner/src/generic-multi-file-transaction.ts`, `generic-multi-file-recovery.ts`, `tests/generic-three-file-crash.test.ts`, and `tests/fixtures/generic-crash-worker.mjs`, plus all included source, tests, manifests, lockfile, and project memory.

## Safe import and next action

Extract to a new directory, verify SHA-256 manifest and inclusion/exclusion inventory, then read `WINDOWS-VERIFICATION.md` and preserve the current M4D.4T verification record. Do not overwrite an existing tree or copy `dist`, `node_modules`, or test results.

## Current Windows status

`O_NOFOLLOW` is unavailable on the verified Windows runtime. Protected Apply/Rollback operations intentionally fail closed with `UNSUPPORTED_SECURE_FILE_ACCESS`; they are not supported on Windows. Capability-gated functional Apply/Rollback tests remain skipped when secure access is unavailable, while dedicated Windows rejection contracts remain active.

Generated artifacts that remain outside commits: `dist/`, `node_modules/`, `packages/rtl-analyzer/dist/`, and `packages/rtl-analyzer/rtl-analyzer-0.1.0.tgz`.

## Restrictions/blockers

Do not commit, push, tag, publish, upload, reset, clean, stash, or delete the original workspace. No credentials or secrets belong in the snapshot. Windows filesystem and crash/restart behavior remain unverified; process-crash evidence is not power-loss evidence.

Historical Windows baseline recovery (2026-11-11): portable Node.js 26.13.1 / npm 11.20.0 is active in Git Bash. `npm ci`, scanner typecheck, and scanner build passed. Focused generic/security/crash tests passed twice (23/23 each) with one explicit EPERM symlink-fixture skip and no unhandled handle errors after directory-handle cleanup fixes. The standalone smoke script then remained blocked by the intentional win32 unsupported filesystem-profile guard. Full scanner coverage was 319 passed, 37 failed, 1 skipped.

Historical M4D.3C: protected readers now use shared fail-closed secure-file access; no `O_NOFOLLOW ?? 0` fallback remains in the affected modules. Unsupported Windows protected operations reject before filesystem mutation. Node 26 typecheck/build passed; existing Apply/Rollback tests failed as expected until their Windows unsupported-operation expectations were split; Windows secure access remains unavailable.

Historical M4D.3D.1: added `windows-secure-access-contract.test.ts`; the initial focused run passed 1/1 and verified Controlled Apply, Generic Apply, Multi-file Apply, and Rollback reject before mutation.

## M4D.3D.8J scope resolution

The native Windows secure-open investigation is stopped. RTL Analyzer targets trusted local developer repositories, not an active local filesystem attacker, and does not promise race-free traversal. Native Windows adapters and C++/MSVC/Windows SDK/NtCreateFile requirements are out of scope; the CLI remains Node.js/TypeScript. Windows policy-backed scanning remains supported. Existing fail-closed restrictions for protected reads, Apply/Rollback, and report publication remain in force; any behavior change requires separate approval.

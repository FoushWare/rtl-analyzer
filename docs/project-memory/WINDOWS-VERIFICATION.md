# M4D.3 Windows verification checklist

## Current Native Windows verification — M4D.4T

Verified in Native Windows PowerShell:

- Full scanner suite: **309 passed, 59 skipped, 0 failed** across **32 test files**.
- `npm run rtl:scan:test`: **309 passed, 59 skipped, 0 failed**.
- `npm run rtl:scan:build`: TypeScript build passed.
- `npm run rtl:cli:package:smoke`: standalone package smoke passed with **31 tarball files**.
- Windows secure-access contract: **9 passed, 0 failed**.
- Output architecture: **8 passed, 0 failed**.

The verified Windows runtime does not provide `O_NOFOLLOW`. Protected Apply/Rollback operations intentionally fail closed with `UNSUPPORTED_SECURE_FILE_ACCESS` and are not supported on Windows. Functional tests requiring secure access are capability-gated; dedicated fail-closed contract tests remain active. The package smoke internally completed JSON, Markdown, and Dashboard scans; those scans are not recorded as separately executed npm scripts, and no `npm run rtl:cli` command is claimed.

Generated artifacts that must remain outside commits: `dist/`, `node_modules/`, `packages/rtl-analyzer/dist/`, and `packages/rtl-analyzer/rtl-analyzer-0.1.0.tgz`.

Run from a fresh Windows import. Record Windows/Node/npm versions and exact output.

1. Install Node.js 22.12+, npm 10+, Python 3, and Chromium; run `npm ci`.
2. Run scanner typecheck/build/tests, package smoke, full typecheck/build, and portable E2E.
3. On NTFS, test junctions/reparse points in project and storage ancestors; they must be rejected or fail closed.
4. Test case-insensitive aliases and Unicode-normalization collisions; ambiguous paths must be rejected.
5. Test hard-linked source files; verify default rejection and explicit policy behavior.
6. Verify atomic replacement preserves content/mode and leaves no temporary file.
7. Start two real apply processes; one must lock and the other must fail with conflict.
8. Terminate a worker at each multi-file boundary, including after one replacement; fresh-process recovery assessment must be read-only.
9. Run the full regression again.

Acceptance: all suites pass; security fixtures fail closed as specified; recovery is deterministic and read-only; no secrets or generated artifacts are in the snapshot; no unexplained source/package differences remain.

Unverified until then: reparse-point edge cases, non-NTFS case behavior, file identity across volumes, power-loss durability, and antivirus/indexer interference.

Historical baseline note (2026-11-11): Node.js 26.13.1 / npm 11.20.0 was active in portable Git Bash. Focused generic/security/crash tests passed 23/23 twice with one explicit EPERM symlink-fixture skip and no unhandled handle errors after cleanup fixes. The standalone smoke then remained blocked by its intentional unsupported Windows filesystem-profile guard. Full scanner coverage was 319 passed, 37 failed, 1 skipped.

Fail-closed access note: protected readers now require `O_NOFOLLOW` through a shared policy and reject with `UNSUPPORTED_SECURE_FILE_ACCESS` before protected Apply/Multi-Apply/Rollback mutation. Windows remains unsupported for these operations because Node 26 exposes no equivalent no-follow open flag; the policy does not claim race-free protection.

Historical test-contract note: the focused Windows contract test initially passed 1/1 and verified no source/storage mutation for protected entry-point rejection. The current suite uses capability-based skips for the five secure-access-dependent functional Apply/Rollback tests and retains dedicated Windows rejection coverage.

## Windows MVP scope after native investigation

The product supports trusted local repositories; active local filesystem attackers and race-free traversal are out of scope. Native Windows secure-open adapters are out of scope. Required MVP work is Node.js/TypeScript behavior: normal scanning, policy loading, standalone CLI execution, Windows path handling, Windows-compatible tests, and packaging/distribution. Existing Apply, Rollback, report-publisher, and other security guards remain fail-closed until separately approved.

Prioritized checklist: (1) verify read-only scanning and policy loading with native Windows fixtures; (2) separate POSIX-only test assumptions without broad skips; (3) make standalone package smoke pass on Windows while preserving content/output guards; (4) verify Windows paths, case behavior, and junction/symlink diagnostics; (5) retain Apply/Rollback contract coverage; (6) rerun packaging from a clean consumer workspace. Optional improvements are clearer unsupported-operation messages and more Windows fixtures. Native race-free traversal, power-loss guarantees, and a Windows Apply/Rollback adapter remain explicitly out of scope.

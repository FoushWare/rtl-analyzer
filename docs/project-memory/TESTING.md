# Testing

From the repository root:

```sh
npm ci
npm run rtl:scan:typecheck
npm run rtl:scan:build
npm run rtl:scan:test
npm run rtl:cli:package:smoke
npm run test:e2e:regression
npm run typecheck
npm run build
```

The scanner suite uses `tools/rtl-scanner/vitest.config.ts`. Portable E2E is 1 apply/rollback + 2 Phase 5 + 20 manual security/lifecycle tests = **23**. Historical counts below are retained for context; current Native Windows results are recorded in the verification section.

Three-file coverage is `tools/rtl-scanner/tests/generic-three-file-crash.test.ts`, with worker fixture `tools/rtl-scanner/tests/fixtures/generic-crash-worker.mjs`. Source-writing tests use disposable temporary directories.

Use Node.js 22.12+, npm 10+, Python 3, and Chromium. E2E uses loopback ports and disposable stores. Windows verification must use native filesystem fixtures and real child-process termination.

Historical Windows baseline recovery (2026-11-11, Node.js 26.13.1 / npm 11.20.0): `npm ci` installed 578 packages successfully; scanner typecheck and build passed. Focused generic/security/crash tests passed twice at 23/23 with one explicit symlink-fixture skip because symlink creation returned EPERM. The standalone smoke then remained blocked by the package publisher's intentional `unsupported platform/filesystem profile` guard on win32. Full scanner coverage was 319 passed, 37 failed, 1 skipped across 357 tests.

M4D.3C evidence: the shared secure-file-access policy removes ordinary-open fallbacks from protected readers and rejects unsupported Windows access before Apply/Multi-Apply/Rollback mutation. Typecheck/build/diff-check pass. The focused run recorded 10 passed, 12 expected unsupported-operation failures, and 1 symlink-fixture skip; existing transaction tests require a later Windows-specific unsupported-operation test split.

Historical M4D.3D.1 contract evidence: `windows-secure-access-contract.test.ts` initially passed 1/1 on Windows and verified Controlled Apply, Generic Apply, Multi-file Apply, and Rollback reject before source or storage mutation.

## Exact current Native Windows commands

The verified command record is:

```text
npm run rtl:scan:test         # 309 passed, 59 skipped, 0 failed
npm run rtl:scan:build        # TypeScript build passed
npm run rtl:cli:package:smoke # Standalone package smoke passed, 31 tarball files
```

The scanner test, TypeScript build, and standalone package smoke commands are recorded separately. The smoke test internally completed JSON, Markdown, and Dashboard CLI scans; those internal scans are not recorded as separate npm scripts. No `npm run rtl:cli` command is claimed.

## Windows test scope

Windows tests validate the supported Node.js/TypeScript workflow for trusted local repositories: read-only scanning, policy loading, path handling, standalone CLI execution, and package installation/execution. POSIX-only fixtures may be separated individually when their primitive is unavailable; broad suite skips are not appropriate. Tests must not imply race-free traversal or an active-local-attacker guarantee. Native security-adapter tests are out of scope, while protected Apply/Rollback and report publication must continue asserting existing fail-closed behavior.

## Current Native Windows verification

- Full scanner suite: **309 passed, 59 skipped, 0 failed** across **32 test files**.
- `npm run rtl:scan:test`: **309 passed, 59 skipped, 0 failed**.
- `npm run rtl:scan:build`: TypeScript build passed.
- `npm run rtl:cli:package:smoke`: standalone package smoke passed; **31 tarball files**.
- The smoke script internally completed JSON, Markdown, and Dashboard scans.
- Windows secure-access contract: **9 passed, 0 failed**.
- Output architecture: **8 passed, 0 failed**.

`O_NOFOLLOW` is unavailable on this Windows runtime. Apply/Rollback intentionally fail closed with `UNSUPPORTED_SECURE_FILE_ACCESS`; capability-gated functional tests remain skipped where secure access is unavailable.

Generated artifacts to keep outside commits: `dist/`, `node_modules/`, `packages/rtl-analyzer/dist/`, and `packages/rtl-analyzer/rtl-analyzer-0.1.0.tgz`.

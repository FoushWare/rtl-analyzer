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

The scanner suite uses `tools/rtl-scanner/vitest.config.ts`. Portable E2E is 1 apply/rollback + 2 Phase 5 + 20 manual security/lifecycle tests = **23**. Current handoff verification passed scanner typecheck/build, 54/54 targeted generic/security/crash/proposal tests, and standalone package smoke (31 tarball files). The reported broader baseline is scanner **356/356**, focused crash/security **46/46 twice**, portable E2E **23/23**, and three-file crash matrix **5/5**; those counts remain historical unless rerun with output.

Three-file coverage is `tools/rtl-scanner/tests/generic-three-file-crash.test.ts`, with worker fixture `tools/rtl-scanner/tests/fixtures/generic-crash-worker.mjs`. Source-writing tests use disposable temporary directories.

Use Node.js 22.12+, npm 10+, Python 3, and Chromium. E2E uses loopback ports and disposable stores. Windows verification must use native filesystem fixtures and real child-process termination.

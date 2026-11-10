# RTL Migration Analyzer v0.1.0 Release Manifest

Status: review draft. This file is a curation plan only; it does not stage, remove, or publish files.

## Verified test count

The exact `npm run test:e2e:regression` script runs three Playwright invocations:

| Invocation | Configuration | Result |
|---|---|---:|
| Apply/Rollback | `playwright.apply-rollback.config.ts` | 1 passed |
| Phase 5 | `playwright.phase5.config.ts` | 2 passed |
| Security/lifecycle group | `playwright.manual-regression.config.ts` | 20 passed |

The security/lifecycle group contains security-negative (16), restart infrastructure (2), stale lifecycle (1), and failed lifecycle (1). Therefore the verified total from the command output is **23 passed, 0 failed, 0 skipped**. The earlier “20 passed” baseline is an arithmetic misstatement of the final invocation, not a changed test result.

## Release allowlist

Status terms: `tracked` means present in `HEAD`; `modified` means tracked with working-tree changes; `untracked` means present locally but not in Git; `ignored` means reproducible output excluded from publication.

### Root configuration and dependencies

| Path | Purpose | Status |
|---|---|---|
| `package.json` | Dependencies and release/test scripts | tracked, modified |
| `package-lock.json` | Reproducible npm installation | tracked |
| `tsconfig.json` | Root TypeScript configuration | tracked |
| `nx.json` | Workspace project configuration | tracked, modified |
| `rtl-scanner.config.json` | Scanner policy/configuration | tracked |
| `eslint.config.mjs` | Repository lint configuration | tracked |
| `tools/rtl-scanner/package.json` | Scanner package metadata | tracked |
| `tools/rtl-scanner/tsconfig.json` | Scanner build configuration | tracked |
| `tools/rtl-scanner/tsconfig.typecheck.json` | Scanner typecheck configuration | tracked |
| `tools/rtl-scanner/vitest.config.ts` | Scanner test configuration | tracked |

### Scanner implementation

Include all files under `tools/rtl-scanner/src/`. These modules are cross-imported and provide the CLI, scanner, schema/report serializers, dashboard, companion runtime, candidate preview, review state, evidence, Apply/Rollback, and security behavior.

Notable status: `tools/rtl-scanner/src/project-root.ts` is untracked and required. The implementation files changed during Analyzer work remain tracked-but-modified and must be included at their reviewed working-tree versions.

### Scanner tests, fixtures, and documentation

Include:

- `tools/rtl-scanner/tests/*.test.ts`
- `tools/rtl-scanner/tests/fixtures/**`
- `tools/rtl-scanner/tests/serve-dashboard-harness.mjs`
- `tools/rtl-scanner/README.md`

The compatibility experiment under `tools/rtl-scanner/tests/experiments/` is not part of the clean-checkout baseline unless its separately documented external setup is intentionally released.

### Portable E2E regression

Include these currently untracked files:

- `playwright.apply-rollback.config.ts`
- `playwright.phase5.config.ts`
- `playwright.manual-regression.config.ts`
- `tests/e2e/portable-fixture.mjs`
- `tests/e2e/phase5-fixture.mjs`
- `tests/e2e/apply-rollback-disposable.spec.ts`
- `tests/e2e/phase5-progress.spec.ts`
- `tests/e2e/security-negative.spec.ts`
- `tests/e2e/restart-infrastructure.spec.ts`
- `tests/e2e/stale-lifecycle.spec.ts`
- `tests/e2e/failed-lifecycle.spec.ts`

These are the files referenced by `test:e2e:regression`. They generate disposable project, dashboard, and state paths and do not require pre-existing fixture directories.

### Required demo application and libraries

Include only the project copied and served by the portable fixture:

- `apps/invoicing/index.html`
- `apps/invoicing/project.json`
- `apps/invoicing/vite.config.ts`
- `apps/invoicing/src/**`
- `libs/shared/project.json`
- `libs/shared/src/**`
- `libs/design-system/project.json`
- `libs/design-system/src/**`

The policy configuration requires this minimal Procurement policy-dependency closure. The Procurement application runtime is not part of the Analyzer release:

- `apps/procurement/index.html`
- `apps/procurement/project.json`
- `apps/procurement/src/App.tsx`
- `apps/procurement/src/main.tsx`

### Analyzer documentation

Include the relevant files under `docs/rtl-analyzer-v3/`, including:

- `README.md`
- `ARCHITECTURE.md`
- `DATA-CONTRACTS.md`
- `ACCEPTANCE-CHECKLIST.md`
- `PRODUCT-VISION.md`
- directly referenced phase and handoff documents
- this manifest

## Exclusions

Do not publish:

- `video-assets/`, `assets/`, and other video/audio production material
- `.agents/`, local agent metadata, and personal project memory
- `review-package/`
- `node_modules/`, `dist/`, `.nx/`, `test-results/`, and `playwright-report/`
- generated reports, screenshots, recordings, exports, logs, and temporary state
- unrelated procurement/application work
- unrelated Atlas demo documentation and historical production material
- `tests/e2e/phase6-full-journey.spec.ts` unless separately made portable
- legacy nonportable configurations and their dependent suites, including `playwright.phase4.config.ts` and `playwright.phase13.config.ts`

The current `.gitignore` covers `node_modules/`, `dist/`, `.nx/`, test outputs, Storybook output, `.DS_Store`, and `*.log`. It does not by itself exclude tracked files or untracked video, agent, or review-package directories. Any ignore-rule proposal requires a separate review and is outside this manifest task.

## Git status and publication risk

Required Analyzer files currently fall into three groups:

- Tracked and modified: `package.json`, `nx.json`, several scanner source files, scanner harness/test files, and the existing Analyzer-related configuration changes.
- Untracked and required: the three portable Playwright configurations, portable fixture helpers, release E2E tests, and `tools/rtl-scanner/src/project-root.ts`.
- Ignored and reproducible: `node_modules/`, `dist/`, `.nx/`, Playwright reports, and test results.

No ignored file should be added to the release. Generated `dist/` must be recreated after installation and before Playwright configuration imports the built scanner modules.

## Planned release strategy

The release remains in the existing GitHub repository. The planned sequence is:

1. Review and curate this allowlist.
2. Prepare a dedicated release branch containing the curated release tree.
3. Verify installation, scanner build/typecheck, and the isolated regression from that tree.
4. Create the product-specific tag `rtl-analyzer-v0.1.0`.

This does not remove unrelated files from existing branches, tags, or reachable history. An orphan-style branch would reduce ancestry exposure from the release branch but would still not remove existing public refs; it is not recommended unless that stronger separation is required.

## Runtime requirements

The clean-checkout procedure must document:

- Node 22.12+ and npm 10+
- `npm ci`
- Python 3 for the disposable dashboard server
- Chromium installed for Playwright
- scanner typecheck and build before E2E
- loopback ports 4200, 4318/4319, and 4320
- disposable temporary directories for project, dashboard, state, and backups

No current portable regression requires a developer-specific absolute path, pre-existing dashboard, pre-existing state store, or pre-existing fixture. Scanner tests create temporary directories through Node's OS-specific temporary-directory API.

## Verified dependency security updates

The dependency updates verified in the isolated release tree and transferred to this working tree are:

- `storybook`: `10.6.1` → `10.6.7`
- `@storybook/react-vite`: `10.6.1` → `10.6.7`
- `vite`: `^6.4.0` → `^6.4.5`, resolving to locked version `6.4.6`
- `overrides.undici`: `^7.29.1` → `^7.30.1`, resolving to locked version `7.30.2`

After `npm ci --ignore-scripts`, `npm audit --json` reports 17 moderate, 0 high, 0 critical, and 0 low findings. The remaining findings are transitive development-toolchain issues; no Critical or High findings remain.

## Unresolved release dependencies and documentation gaps

- The required untracked files are not yet part of Git history.
- Several legacy phase configurations still contain developer-specific absolute paths and must not be included in the portable release workflow.
- A clean checkout has not yet been created; reproducibility from the curated tree remains to be verified.
- The exact minimal invoicing/library dependency closure should be rechecked after the first curated release commit, because Vite and Nx configuration imports may pull additional root files.

## Recommended next action

After approval, review the dedicated release branch/tree containing this allowlist. The curated tree already includes the root Analyzer README and MIT LICENSE; perform clean-checkout verification before the first release commit.

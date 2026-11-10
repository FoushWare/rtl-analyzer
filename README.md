# RTL Migration Analyzer

RTL Migration Analyzer is a conservative, read-only analysis and review tool for finding RTL migration risks in React, TypeScript, CSS, HTML, Emotion, and Material UI codebases.

The project is published by FoushWare. This repository also contains the fictional Atlas invoicing demo application used as an Analyzer fixture and browser-test target. Atlas is supporting demonstration material; it is not the Analyzer product.

## Capabilities

The Analyzer provides:

- Static RTL risk detection with schema-v2 JSON and Markdown reports.
- A self-contained dashboard for browsing files, findings, evidence, severity, and coverage status.
- A local review companion for durable review records, evidence, lifecycle state, and progress.
- Candidate preview runtimes for reviewing proposed changes in disposable project copies.
- Controlled Apply and Rollback workflows with source identity, digest, path, and trusted-root checks.
- Portable Playwright regression fixtures that isolate project files, dashboards, state stores, backups, and service processes.

The scanner is intentionally conservative. A finding is analysis evidence for human review, not proof of a visual defect or authorization to change source code.

See the [scanner documentation](tools/rtl-scanner/README.md), [architecture](docs/rtl-analyzer-v3/ARCHITECTURE.md), [data contracts](docs/rtl-analyzer-v3/DATA-CONTRACTS.md), and [acceptance checklist](docs/rtl-analyzer-v3/ACCEPTANCE-CHECKLIST.md).

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- Python 3 for the portable dashboard HTTP server
- Chromium for Playwright browser tests

The portable regression uses loopback ports 4200, 4318/4319, and 4320. It creates disposable temporary directories and does not require developer-specific fixture paths, pre-existing dashboards, or pre-existing state stores.

## Installation

From the repository root:

```sh
npm ci
```

Install the Playwright Chromium browser used by the regression suite:

```sh
npx playwright install chromium --no-shell
```

## Scanner CLI

Build and typecheck the scanner:

```sh
npm run rtl:scan:typecheck
npm run rtl:scan:build
```

Run a read-only scan:

```sh
node dist/tools/rtl-scanner/cli.js --format json
node dist/tools/rtl-scanner/cli.js --format markdown
```

The CLI also supports `markdown-structured` and `dashboard`. To publish a dashboard and its companion report artifacts into an output directory:

```sh
node dist/tools/rtl-scanner/cli.js \
  --format dashboard \
  --root . \
  --output-dir ./rtl-report
```

The dashboard output is self-contained. Source snippets are opt-in and should be treated as potentially sensitive data.

## Dashboard and Companion

The scanner can generate a static `rtl-report-dashboard.html`. The local Companion serves review APIs for records, evidence, decisions, lifecycle, progress, and audit data:

```sh
npm run rtl:preview
```

The Companion defaults to loopback port 4318 and stores review data under the local user data directory unless explicit `RTL_*` store paths are supplied. Release tests always provide disposable paths.

## Candidate Preview, Apply, and Rollback

Candidate Preview starts an isolated runtime for a proposed change. The review workflow validates the candidate before it can be approved. Apply and Rollback are guarded by:

- repository-relative source paths and trusted-root validation;
- source and policy digests;
- review identity and approval state;
- stale-source detection;
- disposable backup and audit storage;
- symlink and path-traversal protections.

The workflow is designed for explicit human review. The Analyzer does not silently rewrite application source files, and its E2E tests operate only on disposable copies of the invoicing fixture.

## Verification

Run the scanner tests:

```sh
npm run rtl:scan:test
```

Run the complete portable Analyzer regression:

```sh
npm run test:e2e:regression
```

That script runs each suite with its isolated Playwright configuration:

- Apply/Rollback disposable fixture: `playwright.apply-rollback.config.ts`;
- deterministic Phase 5 dashboard fixture: `playwright.phase5.config.ts`;
- security and lifecycle suites: `playwright.manual-regression.config.ts`.

The verified output is 23 passed tests, 0 failed, and 0 skipped: 1 Apply/Rollback test, 2 Phase 5 tests, and 20 security/lifecycle tests.

General repository checks are also available:

```sh
npm run lint
npm run typecheck
npm run build
npm test
```

## Atlas invoicing demo

The bundled Atlas app is a fictional React/Nx/Vite demonstration project used by the portable fixtures. It can be run independently:

```sh
npm run dev
```

This starts the invoicing demo at `http://localhost:4200`. The demo's historical RTL migration material and screenshot gallery are separate from the Analyzer release surface.

## Known limitations

- Static analysis cannot prove the complete computed CSS cascade, runtime ownership graph, browser rendering result, font-dependent collisions, or all dynamic direction behavior.
- Findings require human interpretation and approval.
- The scanner does not provide a general-purpose automated RTL codemod.
- Compatibility experiments under `tools/rtl-scanner/tests/experiments/` require separate external setup and are not part of the normal clean-checkout regression.
- Legacy Atlas phase configurations are not part of the portable release regression and may contain historical machine-specific paths.
- Generated `dist/`, Playwright reports, test results, dashboards, screenshots, and state stores are reproducible artifacts and are not release source files.

For detailed scope, policy, coverage, and security qualifications, see the [Analyzer documentation index](docs/rtl-analyzer-v3/README.md) and [scanner README](tools/rtl-scanner/README.md).

## License

RTL Migration Analyzer is released under the [MIT License](LICENSE).

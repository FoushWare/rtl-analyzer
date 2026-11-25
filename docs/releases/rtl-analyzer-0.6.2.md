# RTL Analyzer 0.6.2 release notes

Release: `rtl-analyzer@0.6.2`, dist-tag `latest`.

## Merged release sources

- Implementation PR [#15](https://github.com/FoushWare/enterprise-rtl-migration-lab/pull/15), merge commit `47ecbcae8ea7e1c6e04a9c906039377a94b03b65` on `codex/companion-session-leases`. The verified head `12c2c6d65ad19c8d7dbab597ed541bcd27073ead` is an ancestor of this merge.
- Wrapper PR [#42](https://github.com/FoushWare/rtl-analyzer/pull/42), merge commit `7994f5e6204ef724fcaf846e77b7fa201dfeef9a` on `main`, verified head `924bf99e7b0ca2b4c297b863f314dd1500e8b9ab`.
- Implementation pin: `12c2c6d65ad19c8d7dbab597ed541bcd27073ead`, in `packages/rtl-analyzer/package.json` and the submodule gitlink.

## Verified performance

Source: [live-preview-performance-v0.6.2-2026-11-25.md](../verification/live-preview-performance-v0.6.2-2026-11-25.md) (round 3, head `bdeb955`).

Scanner scalability (Phase 1), same machine, byte-identical outputs to v0.6.1:

| Project | v0.6.1 scan | v0.6.2 cold | v0.6.2 warm |
| --- | --- | --- | --- |
| 53 files | 4,332 ms | 186 ms | 52 ms |
| 403 files | 293.9 s | 1,438 ms | 403 ms |

Preview navigation (round 3, warm navigation, 20 measurements):

| Build | Warm median | Warm P95 | Runtime starts per run |
| --- | --- | --- | --- |
| v0.6.1 (published) | 1.78 s | 2.40 s | 6 |
| v0.6.2 | 0.84 s | 1.12 s | 1 |

Cold navigation median 2.74 s to 1.98 s. Initial readiness median 1.55 s to 1.05 s. Target warm P95 ≤ 1.5 s is met.

Caveat: these measurements were taken at head `bdeb955`. Commits after it change no scanner or preview behaviour. They remove unused identifiers, add opt-in diagnostics, and change Windows signalling for owned direct children. They were not re-benchmarked.

## Fixes and stability

- Scanner: project-wide scans and cross-file lookups removed from hot paths; outputs unchanged.
- Preview: latest-selection-wins gate for preparations; lock-free contextual reads; heartbeat with a 45 s grace.
- Dashboard: an unmapped first finding no longer opens a blocking modal; large reports (52 stylesheets) reach readiness.
- Lifecycle: owned process groups on POSIX; bounded companion shutdown; orphan workspace sweep at startup, which removes only marked workspaces that are no longer referenced.
- Rollback: `ROLLBACK_FAILED` is recorded for authorized source-conflict rejections, with no source content in the journal.
- Runtime reuse equivalence: the portable-fixture check (`runtime-reuse-equivalence.mjs`) confirms TSX and JSX render identically with and without reuse. It passes in CI.

## Known limitations

- Process-group termination and manifest orphan recovery are POSIX-only. On Windows, only direct children are signalled. Tracked in [rtl-analyzer#43](https://github.com/FoushWare/rtl-analyzer/issues/43).
- Lint: 331 pre-existing ESLint errors on the release head, against 344 on the integration target, with no new fingerprints. Tracked in [enterprise-rtl-migration-lab#14](https://github.com/FoushWare/enterprise-rtl-migration-lab/issues/14).
- The default `npm run test:e2e` run has setup debt. The release-critical suites run through their dedicated configs. Tracked in [enterprise-rtl-migration-lab#16](https://github.com/FoushWare/enterprise-rtl-migration-lab/issues/16).
- The `create-invoice` visual snapshot fails on the current CI runner image, on both the integration target and the release head (230 pixels). Not a v0.6.2 regression. Tracked in [enterprise-rtl-migration-lab#17](https://github.com/FoushWare/enterprise-rtl-migration-lab/issues/17).
- The root cause of a CI-only Python dashboard server stall is not established. The affected suites now use the Node harness. Tracked in [enterprise-rtl-migration-lab#18](https://github.com/FoushWare/enterprise-rtl-migration-lab/issues/18).
- Heartbeat requests are occasionally aborted in browser runs; accumulation is bounded, and the root cause is not identified (round 3 record).
- Large-report main-thread profiling was not measured.
- The round-3 lab check did not cover JS or TSX patch composition. Composition is verified only on the portable runtime-reuse fixture, not for arbitrary patches.

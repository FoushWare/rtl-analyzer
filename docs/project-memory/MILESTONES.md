# Milestones

Evidence is **reported** unless rerun in this workspace.

| Milestone | Scope | Evidence / limits | Readiness |
| --- | --- | --- | --- |
| M1 | Scanner foundation, report model, CLI | Existing scanner docs/tests | Historical complete |
| M2 | Dashboard, reports, discovery, coverage | Existing v3 docs | Historical complete |
| M3 | Review, policy, evidence, controlled apply/rollback | Human approval remains required | Historical complete |
| M4A–M4B | Policy validation and audit safeguards | No CI gate enabled | Historical complete |
| M4C–M4D.1 | Generic apply, journals, recovery, locking | Source and focused tests present | Reported baseline |
| M4D.2 | Runtime configuration proof | Bounded syntax proof; compatibility experiments opt-in | Historical / bounded |
| M4D.2b | Standalone package and multi-file transaction/recovery | Current verification: scanner typecheck/build passed; targeted generic/security/crash suites 54/54; standalone package smoke passed with a 31-file tarball. Historical baseline remains scanner 356/356, focused crash/security 46/46 twice, portable E2E 23/23, three-file crash matrix 5/5. | Complete; ready for Windows verification |

Static analysis does not prove computed CSS, full runtime ownership, browser rendering, power-loss durability, or true multi-file atomicity. Windows filesystem semantics, real process termination, reparse points, case folding, and fresh-process recovery remain unverified.

Next milestone: **M4D.3 — Windows Filesystem & Crash/Restart Verification**.

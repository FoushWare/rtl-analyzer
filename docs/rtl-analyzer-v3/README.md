# RTL Migration Analyzer v3

Status: approved master plan. Documentation only; product implementation has not started.

RTL Migration Analyzer v3 is a self-contained, dark-first developer workspace for investigating RTL migration findings across a multi-application Nx monorepo. The primary workflow is:

`Workspace → scope → file → finding → verified source evidence → copy location`

## Approved decisions

- Keep one self-contained HTML output, with maintainable local CSS/JavaScript sources or templates bundled at build time.
- Add dashboard-only view-model versioning; schema-v2 remains unchanged.
- Treat application attribution as an overlapping set; global finding totals remain unique.
- Distinguish direct application findings, shared-library ownership, shared-library application impact, and unresolved reachability.
- Support English LTR and Arabic RTL UI. Paths, code, rule IDs, source text, and locations remain isolated LTR.
- Support Clipboard API plus a local-file-compatible fallback.
- Land on Code Explorer with deterministic initial finding selection when findings exist.
- Defer scan history, comparison, readiness percentages, progress tracking, and automatic fixes.

## Approved order

1. [Phase 01 — Design System & App Shell](PHASE-01-APP-SHELL.md)
2. [Phase 02 — Code Explorer v3](PHASE-02-CODE-EXPLORER.md)
3. [Phase 03 — Workspace & Application Scope](PHASE-03-APPLICATION-SCOPE.md)
4. [Phase 04 — Arabic / English Localization](PHASE-04-LOCALIZATION.md)
5. [Phase 05 — Overview & Analysis](PHASE-05-OVERVIEW.md)
6. [Phase 06 — Findings & Diagnostics](PHASE-06-FINDINGS-DIAGNOSTICS.md)
7. [Phase 07 — Reports & Video Demo QA](PHASE-07-REPORTS-DEMO.md)

See [Architecture](ARCHITECTURE.md), [Data Contracts](DATA-CONTRACTS.md), and [Acceptance Checklist](ACCEPTANCE-CHECKLIST.md).

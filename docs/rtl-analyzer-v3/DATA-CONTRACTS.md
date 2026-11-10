# Data Contracts

## Dashboard view-model version

Introduce an internal dashboard-only version field when implementation begins, for example `dashboardDataVersion: 1`. It is not added to schema-v2 or any JSON/Markdown serializer.

## Required projections

- `metadata`: kind, schema version, input/policy digests, completeness.
- `scope`: all applications, application records, shared-library ownership, shared-library impact, unresolved reachability.
- `finding`: stable ID, rule/version, category, severity, confidence, title, relative path, range, owner, rationale, treatment, limitation, evidence references, related locations, suggestions, exception metadata.
- `source`: opt-in flag, source windows, finding-to-window references, availability reasons, embedded byte count.
- `diagnostic`: relative path, range, code, impact, blocking status, message, rationale.
- `reports`: fixed sibling artifact links only when generated through output-dir publication.
- `localization`: locale and UI translation keys only; scanner values are not translated.

## Counting rules

- Global findings are counted by stable finding identity once.
- Application attribution is set-based and may overlap.
- Unique affected files are sourced from approved metrics.
- Shared/unresolved reachability is never silently assigned to an application.
- No readiness, effort, progress, or risk score fields are allowed.

## Source data

Use the existing bounded snippet result unchanged. Preserve relative paths, source windows, line numbers, highlight state, and deterministic unavailable reasons. Source embedding is absent unless explicitly enabled.

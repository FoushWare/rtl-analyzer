# Architecture

The scanner discovers supported source without executing application modules, parses CSS, HTML, and TypeScript/TSX through existing adapters, and emits schema-v2 facts, findings, diagnostics, coverage, policy digest, and metrics. Bounded CSS and TypeScript/JSX/Emotion/MUI/Tailwind/Bootstrap patterns produce conservative `FixProposal` values; `edit-set.ts` represents ordered digestable edits.

The standalone CLI in `standalone-cli.ts` delegates scanning and supports JSON, Markdown, structured Markdown, and dashboard output. `packages/rtl-analyzer` is the standalone package boundary; Atlas apps and libraries are demo fixtures, not package runtime dependencies.

Review sets and approvals bind proposal membership and review digests. Generic authorization binds project identity, source paths/digests, edit-set digests, input/policy digests, and transformation versions. Evidence binds source/candidate/edit-set digests and passed syntax checks. Validation rejects stale, mismatched, ambiguous, or incomplete records; human confirmation is required.

Single-file services use trusted-root checks, identity validation, durable records, verified backups, synced temporary files, and same-directory rename. Multi-file apply orders paths deterministically, acquires one project lock, verifies backups, writes prepared/applying journals, records per-file progress, and emits a receipt. This is recoverable but not truly atomic across files.

`generic-multi-file-recovery.ts` is read-only. It compares journals, source digests, receipts/backups, project identity, and original/candidate states, returning applied, rolled-back, partial, recovery-required, conflict, or corruption statuses without writing source.

`generic-trusted-root.ts` rejects traversal, NUL/absolute paths, symlink roots/ancestors, non-regular files, and overlapping roots. `generic-lock.ts` uses an exclusive directory and owner token; conflicts and changed ownership fail closed. Atlas-specific modules and historical production assets remain isolated from generic scanner and transaction modules.

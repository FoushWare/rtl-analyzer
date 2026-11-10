# Phase 02 — Code Explorer v3

Complexity: **L**

## Goal

Make the path from folder to file to finding to verified source evidence the primary workflow.

## Behavior

- Collapsible folder/file tree with finding counts.
- Deterministic initial finding selection.
- File selection updates the finding list.
- Finding selection updates source preview and detail panel.
- Five-line bounded context, line numbers, and highlighted finding lines.
- Copy relative path, location, and finding ID.
- Explicit unavailable states for disabled, omitted, changed, or unverifiable snippets.

## Reuse and files

Reuse `source-snippets.ts` unchanged. Change the dashboard projection/renderer and relevant dashboard/CLI tests only.

## Acceptance

No source is read by browser code, no absolute path is embedded, source is rendered as text, and every finding remains present when a snippet is unavailable.

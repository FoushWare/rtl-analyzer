# Architecture

## Layers

1. Canonical scanner `Report` and schema-v2.
2. `presentation-adapter.ts`, which clones and freezes a renderer-safe presentation view.
3. Dashboard-only projection in `dashboard-data.ts`, versioned internally without changing schema-v2.
4. Self-contained renderer in `dashboard-html.ts`, eventually assembled from maintainable local source modules/templates.
5. Browser-only state for route, selection, search, filters, locale, and preview status.

The browser never reads local files. All source previews come from the opt-in generation-time `source-snippets.ts` result.

## Shell

- Top bar: product identity, completeness, scope, search, locale.
- Navigation: Overview, Code Explorer, Findings, Diagnostics, Reports.
- Explorer workspace: project/file tree, findings list, source preview, finding details.
- Responsive mobile mode: stacked panes with explicit selected states.

## Attribution

Application attribution is a set. A finding can affect multiple applications and is still one finding globally. The UI distinguishes direct application findings, shared-library ownership, shared-library application impact, and unresolved reachability.

## Security

Embedded JSON is escaped against script termination and Unicode separators. Report-derived values are rendered through text nodes. No report-derived `innerHTML`, CSS, executable interpolation, absolute paths, or external resources are permitted.

## Compatibility

JSON, legacy Markdown, structured Markdown, schema-v2, scanner rules, CLI exit codes, publisher semantics, and source-snippet safeguards are preserved.

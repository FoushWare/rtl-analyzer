# Acceptance Checklist

## Compatibility

- [ ] Schema-v2 unchanged.
- [ ] Scanner rules and extractors unchanged.
- [ ] JSON, legacy Markdown, and structured Markdown remain byte-identical.
- [ ] CLI exit codes and stdout/stderr behavior remain compatible.
- [ ] Four-artifact publication, no-overwrite, and rollback guarantees remain intact.
- [ ] No external dependency, CDN, network request, or server is introduced.

## Security and data integrity

- [ ] Source embedding remains explicit opt-in.
- [ ] Existing source-snippet engine is reused.
- [ ] No absolute paths or source text appear in errors.
- [ ] Embedded JSON is script-safe.
- [ ] Report-derived values use text nodes.
- [ ] No report-derived `innerHTML` or executable interpolation exists.
- [ ] Privacy warning is visible when source is embedded.
- [ ] Trusted-workspace TOCTOU and snapshot limitations remain documented.

## Correctness

- [ ] UTF-16 offsets and one-based positions remain intact.
- [ ] Source highlights and unavailable reasons remain accurate.
- [ ] Overlapping application attribution is not double-counted globally.
- [ ] Direct, shared, impacted, and unresolved scope semantics are distinct.
- [ ] Incomplete scans, diagnostics, skipped paths, and evidence integrity remain visible.
- [ ] No readiness or risk metrics are invented.

## UX and accessibility

- [ ] Code Explorer is the default landing view.
- [ ] Initial selection is deterministic.
- [ ] Overview, Explorer, Findings, Diagnostics, and Reports are navigable.
- [ ] Keyboard navigation and visible focus states work.
- [ ] Desktop and mobile layouts work.
- [ ] English and Arabic UI work.
- [ ] Technical values remain LTR-isolated.
- [ ] Clipboard API and local-file fallback work or fail visibly.
- [ ] Browser QA is completed or explicitly marked unavailable.

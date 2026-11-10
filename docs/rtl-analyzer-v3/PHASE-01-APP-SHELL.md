# Phase 01 — Design System & App Shell

Complexity: **M**

## Goal

Establish the dark-first visual system, responsive shell, navigation landmarks, and Code Explorer-first landing behavior without replacing the existing Explorer workflow wholesale.

## Expected implementation files

- `tools/rtl-scanner/src/dashboard-html.ts`
- `tools/rtl-scanner/src/dashboard-data.ts`
- `tools/rtl-scanner/src/cli.ts` only if shell metadata requires existing CLI context
- `tools/rtl-scanner/tests/dashboard-html.test.ts`
- Relevant CLI regression tests
- `tools/rtl-scanner/README.md` only for user-visible contract documentation

Do not modify schema-v2, scanner rules, serializers, publisher, source-snippets.ts, fixtures, or application code.

## Design system

Define CSS custom properties for background/surface layers, text/muted text, borders, focus rings, selection, severity/category states, code surface, spacing, typography, and breakpoints. Use dark-first contrast and preserve a readable code font stack without external fonts.

## Shell behavior

1. Add persistent top bar and navigation landmarks.
2. Make Code Explorer the default view.
3. Select the first finding by deterministic path/position/ID order when findings exist.
4. Preserve the current tree, finding list, source preview, detail pane, copy actions, search, and filters.
5. Add explicit empty and unavailable states.
6. Add responsive stacked panes for narrow viewports.
7. Apply LTR-ready structure so Arabic UI can be added without changing code direction.

## Maintainable renderer strategy

First extract fixed CSS and JavaScript constants into local source modules or template fragments while preserving the same `dashboardHtml()` output contract. Bundle those sources into the generated document at build time. Do not introduce a runtime loader, CDN, or new dependency. Keep the current projection and DOM-only rendering path intact during extraction.

## Tests and acceptance

- Dashboard HTML remains self-contained and deterministic.
- Hostile report strings remain escaped.
- Navigation, headings, focus styles, and controls are present.
- Default output contains no source snippets.
- Existing JSON/Markdown/structured Markdown bytes remain unchanged.
- Four-artifact publication and CLI exit behavior remain unchanged.
- Visual QA confirms desktop 16:9 and narrow responsive layouts where a browser is available.

## Risks

The main risk is an unnecessary renderer rewrite. Work should proceed as extraction and shell composition around the existing Explorer, with byte-sensitive compatibility tests protecting non-dashboard artifacts.

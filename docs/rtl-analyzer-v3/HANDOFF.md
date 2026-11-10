# RTL Migration Analyzer v3 Handoff

Status: approved for Phase 01 implementation.

## Current boundary

This directory records product architecture and phase plans only. No v3 implementation is included here. The existing dashboard, CLI, presentation adapter, and secure source snippet engine remain the implementation authority.

## Next action

Implement Phase 01 in the approved files after confirming the dashboard-only view-model version, maintainable local CSS/JavaScript bundling approach, and browser QA target.

## Do not change

Do not modify scanner schema-v2, scanner rules, extractors, legacy serializers, publisher guarantees, application fixtures, or the Phase 1 source-snippet engine as part of the app-shell work.

## Open follow-ups

- Decide whether maintainable renderer source is bundled through TypeScript modules or local template fragments.
- Decide the exact internal dashboard data-version field name.
- Confirm Chrome/Safari visual-QA availability for local HTML.

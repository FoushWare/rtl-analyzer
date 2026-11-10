# Phase 03 — Workspace & Application Scope

Complexity: **L**

## Goal

Explain multi-application Nx impact without treating attribution as exclusive.

## Behavior

- All-workspace scope.
- Individual application scopes.
- Shared-library ownership scope.
- Shared-library application-impact scope.
- Unresolved reachability scope.
- Visible overlap indicators when a finding belongs to multiple applications.

## Data rules

Global totals remain unique by finding ID. Scope filtering changes the visible set, not the meaning of the canonical report. Empty application attribution means unresolved reachability, not no consumers.

## Acceptance

Tests cover overlapping applications, shared libraries, direct findings, and unresolved reachability without double-counting.

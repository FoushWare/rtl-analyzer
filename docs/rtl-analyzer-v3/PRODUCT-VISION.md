# Product Vision

## Audience

Developers, Tech Leads, and migration planners investigating static RTL risks in enterprise React/Nx workspaces.

## Experience

The interface should feel like a focused developer tool: code is the visual focal point, findings are actionable investigation units, and every claim is traceable to scanner evidence.

The default view is Code Explorer. When findings exist, the initial selection is deterministic: findings are ordered by repository-relative path, source position, and stable finding ID; the first finding is selected. When no finding exists, the UI shows a deliberate empty state.

## Truthfulness

The product presents potential static issues, not confirmed visual failures. It must not invent readiness scores, effort estimates, progress percentages, risk scores, or remediation claims. Shared and unresolved reachability must remain visible rather than being interpreted as zero impact.

## Visual direction

Dark-first, compact, high-contrast, and video-ready. The approved reference emphasizes a persistent navigation rail, workspace/application scope, file tree, finding list, code preview, and finding detail panel. Charts and overview cards support navigation; they do not replace source investigation.

## Boundaries

The dashboard remains a standalone HTML file with no server, CDN, network request, runtime dependency, or filesystem access. Source embedding remains explicit opt-in and uses the closed Phase 1 snippet engine.

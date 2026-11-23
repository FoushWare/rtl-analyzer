# Examples

Six standalone demo projects for [RTL Analyzer](../packages/rtl-analyzer/README.md). Each README is self-contained: set up a disposable copy, run the app, scan with `npx rtl-analyzer` (npm `latest`; `rtl-analyzer@next` for the 0.5.0 prerelease), and open Fix Studio where supported. They are source-only and are not part of the npm package.

- [Foundations Lab](foundations-lab/README.md) — a Vite account page with spacing, edge, transform and drawer defects.
- [Account Checkout](account-checkout/README.md) — a React checkout with two supported fixes and one review-only case.
- [Admin Dashboard](admin-dashboard/README.md) — a React orders dashboard with a table, dialog and tabs; includes a known status-badge limitation.
- [Bilingual Storefront](bilingual-storefront/README.md) — a Next.js and Tailwind storefront; static scan only, no live preview.
- [Interaction Playground](interaction-playground/README.md) — drawer, rating and slider keyboard behavior; every finding is manual review.
- [Workspace Integration](workspace-integration/README.md) — an Nx workspace with two apps and a shared library.

Windows is unsupported. Earlier build notes are kept under [docs/verification/examples-history](../docs/verification/examples-history/).

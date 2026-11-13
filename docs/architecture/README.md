# RTL Analyzer architecture map

This directory is the reviewed GitHub Pages publication surface for the RTL Analyzer architecture map.

- Public URL: `https://foushware.github.io/rtl-analyzer/`
- Entry point: `index.html`
- Source of truth: the ignored `floorplan/` workspace
- Current source revision: `a7b673b57522c6499e1615c4ef27d79fe1ca2840`

The map is a self-contained Floorplan export. It does not expose the editable Floorplan cache, worksheets, source descriptions, or repository files.

## Refresh procedure

After a major architecture change, rebuild the local map with the official Floorplan workflow, review the generated HTML for secrets, local paths, private URLs, and unexpected metadata, then replace this directory's `index.html` with the newly reviewed export. Verify it under the `/rtl-analyzer/` base path before requesting publication.

This directory is prepared locally only. GitHub Pages is not enabled and nothing has been published.

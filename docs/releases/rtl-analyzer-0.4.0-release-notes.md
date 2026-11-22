# RTL Analyzer 0.4.0

**Status: prepared, not published.** Candidate for npm `latest`. Implementation `aa8873ebaee0f0c3a1448462eaf83e21a90ab89c` (bundled at build time). See the [preparation record](rtl-analyzer-0.4.0-preparation-2026-11-22.md) for evidence.

## What's new since 0.3.0

- **Review one by one shows only the selected finding in Live After.** Previously every finding you had opened accumulated in one shared candidate, so a finding's After included other findings' edits. Accepted findings keep their decision; Validate and Apply use the accepted set only.
- **Candidate runtimes are released reliably.** Apply and Rollback stop that workflow's candidate runtime immediately; shutdown (including the repeated Ctrl-C that `npx` forwards) stops every owned runtime and leaves no process or port behind. Sessions, candidate files and receipts needed for protected rollback are kept.
- **Cold-start preview failures fixed.** A fresh candidate Vite runtime reloads once after first load; evidence capture now retries that one failure (bounded to three attempts) instead of reporting *Preview preparation failed: Execution context was destroyed*. This also restores the release smoke gate, which had been failing since implementation `cb75b88`.
- **Guided review.** Explicit review-mode entry, project-wide navigation across files, per-review draft restoration, journaled Validate/Apply dialogs with an authoritative summary, and Deferred carry-forward.
- **Batch review.** *Prepare all, then review* lists prepared fixes in an overview; you approve selected rows, validate, and apply with explicit confirmation. Preparing never writes source.
- **Configured CSS proposals.** Declare exact fix intent (`cssProposals`) for borders, offsets and transforms the scanner would otherwise leave as manual review.
- **Scoped runtime evidence.** Direction checks are bound to verified runtime targets; missing bindings are explained and manual-only findings no longer offer a candidate launch.
- **Dashboard.** Five color themes, accessible selected-control colors, narrow-width dialogs.
- **README and examples.** A screenshot-led README and six runnable example projects with a [hands-on testing guide](../guides/example-testing-guide.md).

## Known limitations

- Live preview supports Vite-compatible development scripts (including Nx running Vite). Next.js can be scanned but not previewed.
- Admin Dashboard `.statusBadge`: Validate is Unavailable (`DIRECTION_EVIDENCE_AMBIGUOUS_TARGETS`, three rows without unique keys).
- Interaction Playground: all findings are manual review; JavaScript key handling is not detected.
- Each focus switch in one-by-one mode restarts the candidate runtime (about 2 to 5 s).
- A SIGKILL of the companion itself still orphans runtimes; `$TMPDIR/rtl-review-*` candidate folders are not deleted.
- Protected report/source operations use the trusted POSIX profile; Windows is unsupported and the Windows CI leg fails. Safari, other package managers and real-world project acceptance are unverified. Existing repository lint debt is accepted as in 0.3.0.
- Human acceptance of this release (Ahmed) is pending.

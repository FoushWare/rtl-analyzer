# Copyable Claude handoff

Continue the RTL Analyzer work from the local public wrapper and pinned implementation below. The user requested this handoff and authorized the acceptance checks described in the linked record. Any new implementation work, release, publication, or deployment needs its own authorization. Treat Ahmed's walkthrough as pending human acceptance.

- Wrapper root: `/Users/a.fouad/rtl-analyzer-0.3.0-prep`. Read its `AGENTS.md` and `docs/project-memory/README.md`. The authoritative scanner and dashboard sources are in the `implementation` submodule. The iCloud private scanner and specimen project are historical for this acceptance.
- Verified package: local public `rtl-analyzer@0.3.0` tarball SHA-256 `ddad9d24c450baa1afbff7f1cb1843c7b4afa3cf68baae49465abb090a3a053d`, wrapper build commit `d6e4c61343b53499a896aa15e33ff18d56b9dc84`, implementation `67c774823622f4ef8061f9fc5372978ad0e95022`. Keep package provenance attached to any additional verification.
- Actual Northstar fixture: `/Users/a.fouad/rtl-analyzer-dashboard-run/acceptance-repair/pending/project`. Walkthrough: `http://127.0.0.1:4320/rtl-report-dashboard.html`. Check the current supervisor and project root in `/Users/a.fouad/rtl-analyzer-dashboard-run/environment.json` before using or restarting it.
- Northstar has 10 verified Original targets and eight real candidates. The spacing converter generated one proposal from source plus ownership. Seven proposals use explicit project intent with a stylesheet digest; the Analyzer generates the concrete CSS. The status dot intentionally stays on physical right. Mobile nav remains manual until Ahmed chooses toolbar-first or links-first Tab order.
- Review [the acceptance record](northstar-webkit-acceptance-2026-11-22.md), [project inventory](rtl-analyzer-project-inventory-2026-11-22.md), and [CSS proposal setup](../guides/css-proposal-setup.md). Keep the original fixture defects for the walkthrough. Run any Apply or rollback acceptance on disposable copies.
- Next, collect Ahmed's assessment of the eight cases and the remaining mobile keyboard-order decision. If a manual HTML proposal workflow is later approved, scope it to isolated staging of concrete multi-file edits, runtime review in the chosen viewport, explicit approval, validation, accepted-only Apply, and protected rollback.

## Transition branch and next-task prompt

Start at [START-HERE](../handoffs/claude/START-HERE.md). The transition branch carries the sanitized Northstar source at `examples/foundations-lab/`, the catalogue and the setup/acceptance/navigation docs. Use [Reproduce](../handoffs/claude/REPRODUCE.md) to make an isolated consumer. See the [media index](../handoffs/claude/MEDIA.md) for local-only files.

When Ahmed is ready to continue, use this separately from the read-only first prompt:

> Continue RTL Analyzer from START-HERE. First reproduce the walkthrough in a disposable clean-clone example and compare it with the recorded eight candidate Afters. Record my walkthrough feedback and ask me to decide the mobile navigation Tab order. Keep the baseline defects, resolve reproducible generic blockers without expanding scope, and prepare the canonical example and visual README work for review. Use project configuration for intent and verify any generic changes on an independent project. Leave the protected login/API example deferred. Do not merge, tag, publish or deploy without separate authorization.

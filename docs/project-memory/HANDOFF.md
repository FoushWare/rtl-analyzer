# RTL Analyzer release-preparation handoff

**Verified 2026-11-19.** Approved release-preparation work is on `codex/rtl-analyzer-0.3.0-prep`, based on published release source `253912c85dfadda09abb42361b9a9776dc9916eb`. Exact resulting commit/remote identity is in Git. The [release record](../releases/rtl-analyzer-0.3.0.md) owns versions, source pin, packed manifest/hashes, consumer commands/exits, limitations and publication procedure.

Public package stays **rtl-analyzer**, proposed **0.3.0** (latest is 0.2.0). Its existing standalone router bundles the implementation submodule, pinned to lab commit `0a10d65b` (full SHA in package metadata), descending from preserved checkpoint `8ea82bf`. No second public scanner package. Run `git submodule update --init` before `npm ci`. Build/tests/consumer scripts now use the pinned implementation; legacy source remains preserved.

The exact versioned wrapper tarball passes default dashboard/scan/preview, both review modes, six checks per mode, accepted-only Apply and hash-exact rollback outside both repositories. See the release record, not historical scanner-only smoke, for proof. Ahmed's external README is integrated with verified corrections. **Ahmed manual acceptance [ ]** remains pending. Root lint remains failing and cross-platform/current Windows acceptance is pending; older Windows milestone reports do not certify this implementation. Existing historical artifacts and original release worktrees remain untouched.

Normal scoped commit/push is authorized by the current task. Do not tag, publish npm, create a GitHub release or deploy until separate approval; `release.published` is the actual npm trigger. No force-push. This dated handoff supersedes only older current-status/next-action claims, not their historical evidence.

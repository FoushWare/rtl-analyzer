# RTL Analyzer 0.3.0

RTL Analyzer now includes configured live Fix Studio review through the existing public `rtl-analyzer` package.

- Keep the default scan/dashboard workflow, positional `scan [path]`, report formats and exit codes; start configured review with `rtl-analyzer preview`.
- Prepare one suggestion or the supported inventory in an isolated candidate. Both modes start Pending. Explicit acceptance, accepted-only validation and separate source Apply remain required.
- Review mapped components in RTL and LTR, run configured project checks, and restore receipt-backed source changes through rollback.
- Preserve conservative static scanning, with explicit project configuration taking precedence. Utility findings use per-token IDs/counts; historical approvals do not transfer. Utility classes and SCSS declarations remain detection-only.
- Bundle the pinned implementation into this package; consumers need no source checkout or separate scanner package.

Requires Node.js 22.12+. Read-only scans need no configuration. Live review needs project/runtime configuration, installed project dependencies and Chromium; the current adapter supports Vite-compatible development scripts. Report output must use an existing external directory.

The release accepts existing repository lint debt and defers broader platform and real-world acceptance. Protected report/source operations require the trusted POSIX profile; Windows protected operations are unsupported. Safari, other package managers and Ahmed's manual visual/workflow acceptance remain pending. Automated checks do not imply that acceptance. No general framework compatibility is certified.

See the [developer testing guide](https://github.com/FoushWare/rtl-analyzer/blob/main/docs/guides/developer-testing.md) for exact setup and commands, and the [dated release evidence](https://github.com/FoushWare/rtl-analyzer/blob/main/docs/releases/rtl-analyzer-0.3.0-publication-2026-11-20.md) for verification and limitations.

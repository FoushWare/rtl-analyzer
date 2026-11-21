# RTL Analyzer

Find direction-dependent styles, inspect suggested fixes, and review changes for RTL and LTR interfaces.

[View on npm](https://www.npmjs.com/package/rtl-analyzer) · [Quick start](#quick-start) · [Review modes](#review-modes) · [Example](#example) · [Developer testing guide](https://github.com/FoushWare/rtl-analyzer/blob/main/docs/guides/developer-testing.md)

## Quick start

Requires **Node.js 22.12 or later**. Run from your frontend project's root:

```sh
npx rtl-analyzer
```

Or install as a development dependency:

```sh
npm install --save-dev rtl-analyzer
npx --no-install rtl-analyzer
```

The default command scans the current directory, writes reports to an external temporary directory and requests your default browser. It does not start the live review services. For a scan of a specific directory or command help:

```sh
npx rtl-analyzer scan ./src --format json
npx rtl-analyzer --help
npx rtl-analyzer preview --help
```

Read-only recursive scans need no configuration. **Live Fix Studio review requires configuration**: explicit scan/copy scope and validation scripts in `rtl-project.config.json`, source/selector/route bindings in `rtl-preview.config.json`, your project's installed dependencies, and Chromium. The current runtime adapter supports Vite-compatible development scripts. Follow the [developer testing guide](https://github.com/FoushWare/rtl-analyzer/blob/main/docs/guides/developer-testing.md) to generate a source-enabled dashboard, serve it and start the companion with `npx --no-install rtl-analyzer preview`.

See the [CSS proposal setup guide](docs/guides/css-proposal-setup.md) for spacing proposals, project-declared intent, and refreshing stylesheet digests.

## What you can review

| In Fix Studio | What it helps you understand |
| --- | --- |
| Findings list | Which direction-dependent patterns need attention |
| Highlighted source | Where a finding appears in your code |
| Details | Why the pattern may affect RTL behavior |
| Before / After | What the suggested fix changes |
| Component Review | How the change fits the component's intended behavior |
| Decision | Whether to accept the proposed change |

## Review modes

| Mode | Workflow | Choose it when… |
| --- | --- | --- |
| Prepare all, then review | Prepare supported suggestions in an isolated candidate, then inspect them together. | You want to review the proposals together. |
| Review one by one | Prepare and inspect a selected suggestion in isolation. | You want to examine each proposal individually. |

Both modes start **Pending**. Preparation leaves your source unchanged. Explicitly accept the proposals you want, run **Validate changes** on that accepted set, then use the separate **Apply accepted changes to source** action. Receipt-backed rollback restores applied changes when the source still matches the receipt. The persisted batch-mode identifier remains `apply-first`.

## Example

A card uses physical left and right spacing:

```css
.card {
  margin-left: 16px;
  padding-right: 24px;
  text-align: left;
}
```

A suggested change uses logical properties:

```css
.card {
  margin-inline-start: 16px;
  padding-inline-end: 24px;
  text-align: start;
}
```

In horizontal writing mode (`horizontal-tb`), inline-start maps to the left in LTR and to the right in RTL. Use this change when the spacing should follow the text direction; keep physical positioning when the design requires a fixed side.

## A typical review

1. Configure the project and scan it with source snippets enabled.
2. Start the dashboard server and companion, then choose a review mode.
3. Inspect a finding, its highlighted source and the mapped component.
4. Compare the original code with the suggestion in RTL and LTR.
5. Accept, reject or defer the proposal according to the component's intent.
6. Validate the accepted set, then separately apply it to source.
7. Verify the affected interface in both RTL and LTR.

If source or accepted decisions change during review, freshness checks can invalidate suggestions or validation. Failed or unavailable required evidence blocks source Apply.

## What a scan does—and what still needs checking

| The tool helps with | You still need to check |
| --- | --- |
| Finding direction-dependent code patterns | Whether the pattern is actually a bug |
| Suggesting direction-aware alternatives | Whether the change matches the design |
| Showing source context and proposed changes | The rendered component in RTL and LTR |
| Identifying potentially stale suggestions | The latest source before applying a change |

Static HTML/CSS, CSS Modules, React inline styles, Emotion and MUI patterns are analyzed conservatively. Recognized utility classes and bounded SCSS declarations are detection-only; dynamic or ambiguous syntax may remain unsupported. A scan reports potential issues. It does not prove that a page renders correctly or replace browser testing.

Report publication and protected source operations use a trusted POSIX filesystem profile on macOS/Linux. Windows protected operations are unsupported. Safari, other package managers and an existing real-world project's acceptance remain unverified; no general framework compatibility is certified. Project scripts must be trusted. See the [setup and limitations](https://github.com/FoushWare/rtl-analyzer/blob/main/docs/guides/developer-testing.md) and [release evidence](https://github.com/FoushWare/rtl-analyzer/blob/main/docs/releases/rtl-analyzer-0.3.0.md).

## Demo

A video walkthrough and released-product screenshots have not been published yet.

## Development

The public package bundles the pinned implementation at build time. Consumers install `rtl-analyzer`; the internal `@atlas/rtl-scanner` package is private. Clone with submodules and follow the [build, pack and verification commands](https://github.com/FoushWare/rtl-analyzer/blob/main/docs/guides/developer-testing.md#build-pack-and-verify). The package is licensed under [MIT](https://github.com/FoushWare/rtl-analyzer/blob/main/packages/rtl-analyzer/LICENSE).

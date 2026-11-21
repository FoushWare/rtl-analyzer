# Set up CSS proposals for an external project

Run the installed `rtl-analyzer scan` to find the original declaration, path and scanner context. For live review, configure scan and candidate copy scope plus validation commands in `rtl-project.config.json`. Configure the Vite-compatible app entry, startup script, ready selector, LTR/RTL URLs and exact source-to-target mapping in `rtl-preview.config.json`. Install project dependencies and the Playwright Chromium runtime. The installed Companion uses Chromium for server-side validation even when the reviewer opens the dashboard in Safari or WebKit.

## Spacing proposals from source

Declare the stylesheet or its exact context as owned `custom-css` in `rtl-scanner.config.json`. For eligible standalone, simple class rules, the Analyzer can generate a logical conversion for literal physical margin or padding without a `cssProposals` entry or source digest. Unsupported values, cascade conflicts and unresolved conditions can block the converter. This is a syntactic proposal. Review that the edge really should follow the reading direction and explicitly approve the candidate before validation and Apply.

## Proposals driven by project intent

Add an entry in `cssProposals` with the exact scan `path`, `context`, original `property` and `value`, supported `kind`, and lowercase SHA-256 `sourceDigest` of the stylesheet. Keep `custom-css` ownership and the live target mapping. Supported kinds are `inline-edge`, `logical-corners`, `dom-order` and `mirror-offset`. The configuration describes the intended transformation. The Analyzer checks source shape and produces the replacement. This is not a general-purpose way to stage arbitrary replacement text.

From the external project root, get the digest with:

```sh
shasum -a 256 src/lab.css
```

Copy only the first field. On systems with `sha256sum`, `sha256sum src/lab.css` returns the same digest. Hash the file as stored, including whitespace and line endings. Do not hash only the declaration. After editing or applying changes to the stylesheet, rescan and reconfirm each remaining intent against the current rule before updating the digest. If the context, property, or original value changed, update those anchors too, or remove the entry if the intent no longer applies.

If the declaration still matches the entry but the file digest changed, proposal preparation reports `CSS_INTENT_STALE_SOURCE` and produces no configured patch. The finding and Original preview can still be available. A changed context, property or value stops matching the entry. The scanner does not issue a separate orphan-entry warning, and any finding is then subject to the ordinary rules and eligibility checks. An already open review may additionally require a rescan because its source or policy identity changed.

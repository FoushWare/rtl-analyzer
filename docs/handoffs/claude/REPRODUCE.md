# Reproduce the RTL Analyzer checkpoint

## Build and install

Use Node 22.12+ with npm, Python 3, and the Playwright Chromium runtime. In the public wrapper checkout:

```sh
git submodule update --init implementation  # fresh clean clone
npm ci
npm --prefix implementation ci
npm run rtl:scan:typecheck
npm --prefix implementation run rtl:scan:test -- --run
pack_dir=$(mktemp -d /private/tmp/rtl-wrapper-pack.XXXXXX) # macOS real path
npm pack --pack-destination "$pack_dir" ./packages/rtl-analyzer
shasum -a 256 "$pack_dir/rtl-analyzer-0.3.0.tgz"
```

The prepack build verifies the implementation commit and reads the pinned Git objects. To re-run the existing full installed-package smoke instead, use `npm run rtl:cli:package:smoke` with the walkthrough stopped so the loopback ports are free. A rebuild can produce a different archive hash. Use the [local acceptance archive](../../verification/northstar-webkit-acceptance-2026-11-22.md) when exact artifact identity matters.

From the wrapper checkout, copy the example to a new disposable sandbox. Keep the wrapper, its submodule and the canonical example as source. Consumer installs, reports, candidate roots, Vite caches, audit stores and transaction copies are generated state. Keep backups and receipts until any rollback or investigation has finished.

```sh
run=$(mktemp -d /private/tmp/rtl-foundations.XXXXXX)
cp -R examples/foundations-lab "$run/project"
mkdir -p "$run/reports" "$run/state/backups"
cd "$run/project"
npm ci
npm install --no-save --package-lock=false "$pack_dir/rtl-analyzer-0.3.0.tgz"
npx --no-install playwright install chromium
npx --no-install rtl-analyzer scan --root "$PWD" --format dashboard \
  --output-dir "$run/reports" --embed-source-snippets
```

Run the following in separate terminals with the same `run` value. Stop each foreground command with Ctrl-C in its own terminal. Check that the intended ports are free before starting.

```sh
cd "$run/project"
npm run dev                         # direct Vite app :4215
```

```sh
cd "$run/project"
export RTL_PROJECT_ROOT="$PWD"
export RTL_REVIEW_STORE_PATH="$run/state/review-records-v1.json"
export RTL_EVIDENCE_STORE_PATH="$run/state/review-evidence-v1.json"
export RTL_MANUAL_CHANGE_STORE_PATH="$run/state/manual-changes-v1.json"
export RTL_SCAN_MANIFEST_STORE_PATH="$run/state/scan-manifests-v1.json"
export RTL_AUDIT_STORE_PATH="$run/state/apply-audit-v1.json"
export RTL_APPLY_BACKUP_ROOT="$run/state/backups"
npx --no-install rtl-analyzer preview  # Companion :4318
```

```sh
python3 -m http.server 4320 --bind 127.0.0.1 --directory "$run/reports"
```

Check `curl -fsS http://127.0.0.1:4318/health` and verify its `projectRoot`. Open [the dashboard](http://127.0.0.1:4320/rtl-report-dashboard.html). The Companion starts the Original bridge on :4216 on demand. Confirm `curl -fsS http://127.0.0.1:4216/__rtl_preview_identity` after the Original loads. Candidate ports are allocated by the Companion. Review both directions and both workflows before accepting. Keep approval, validation, Apply and rollback checks inside the disposable copy.

## Existing walkthrough on Ahmed’s Mac

Inspect `/Users/a.fouad/rtl-analyzer-dashboard-run/environment.json` and Companion health first. The current verified app is `acceptance-repair/pending/project` under that run directory. Start the existing local supervisor with `node /Users/a.fouad/rtl-analyzer-dashboard-run/serve.cjs` when it is stopped. Stop it with `node /Users/a.fouad/rtl-analyzer-dashboard-run/stop.cjs`; the script verifies the supervisor identity before sending a signal. A stale PID or occupied port is a reason to inspect ownership. Use the foreground terminal, supervisor or owning service to stop it.

Restore the baseline through workflow rollback when an Apply receipt exists. If rollback reports drift, preserve the changed copy and investigate. For a fresh walkthrough, make a new disposable copy of the checked-in fixture. Do not reverse changes by copying candidate CSS or by regenerating digests without reviewing intent. See the [CSS proposal guide](../../guides/css-proposal-setup.md).

# RTL Analyzer v3 — Lifecycle and Full-Journey Acceptance Matrix

| Lifecycle | Authoritative event | Persisted evidence | Dashboard assertion | Browser action |
|---|---|---|---|---|
| Pending | No decision, review, evidence, or audit event | Finding exists in the current manifest | `State: Pending` | Open a fresh finding |
| In Progress | Decision or candidate/review record exists without completed evidence | Decision/review record | `State: In Progress` | Save treatment or propose candidate |
| Applied | Successful controlled apply audit with matching current source hash | Apply receipt and `APPLIED` audit event | `State: Applied` | Approve, apply, reload |
| Validated | Approved review plus immutable evidence whose scanner-after finding is absent | Approved review and evidence snapshot | `State: Validated` | Run validation, archive evidence, approve |
| Failed | Validation/apply/rollback failure event or Validation Failed review | Failure result or failure audit | `State: Failed` | Trigger a bounded failing operation |
| Stale | Applied/evidence source hash no longer matches current source, or incomplete rescan absence | Source hash mismatch or stale reconciliation | `State: Stale` | Change disposable source or submit incomplete rescan |
| Rolled Back | Successful rollback audit event | Rollback receipt and `ROLLED_BACK` audit event | `State: Rolled Back` | Apply, then rollback |

Acceptance invariants:

- A decision alone never produces a completed lifecycle state.
- Every assertion reads the companion projection after the browser action.
- Reload and a fresh companion process must recover the same persisted state.
- Apply and rollback use disposable fixtures only; the real Invoicing checkout is never a target.

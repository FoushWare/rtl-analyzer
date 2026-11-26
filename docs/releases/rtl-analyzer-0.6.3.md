# RTL Analyzer 0.6.3 — release notes

## Security

- **Companion session authorization.** Every call to the preview companion now needs a session minted with the per-run bootstrap
  secret. The secret is an owner-only file. Sessions are isolated, expire when idle, and are revoked when the companion restarts.
- **Host validation and DNS-rebinding protection.** The companion accepts only its loopback host names. Requests with a foreign
  `Host` or `Origin` are refused.
- **Re-authorization after a companion restart.** A running dashboard mints a new session when the companion publishes a new
  bootstrap secret. A token issued under the previous secret is not reused.
- **Path and sensitive-information protection.** Error responses carry no absolute project paths. Source paths outside the
  project root and symlink escapes are refused before any read or write.
- **Apply and Rollback integrity.** Apply and Rollback require explicit confirmation. Rollback refuses an untrusted receipt,
  a receipt whose backup no longer matches its original hash (`ROLLBACK_BACKUP_MISMATCH`), and a source that changed after
  apply (`ROLLBACK_CONFLICT`), and it changes no byte in those cases. A rolled-back transaction is never replayed.
- **Lint ratchet.** CI blocks new lint violations. The existing lint debt is recorded by identity and is not waived.

## Known limitations (deferred, tracked separately)

- **Review One-by-One preview startup.** In the review journey, the modified preview can report that it did not start in
  time. This is a pre-existing v0.6.2 defect. It is not a security or source-integrity defect. It is visible in CI as a
  non-blocking diagnostic job.
- **Apply First batch review.** The batch review's "View diff" action is not reached in the Apply First journey. This is also
  a pre-existing v0.6.2 defect and is visible in the same diagnostic job.
- **Windows.** Windows CI passes for the security tests. Windows is not a supported platform for protected operations in this
  release, and this release does not advertise Windows support.
- The companion's stderr is still not captured from the dev server it starts (unchanged from 0.6.0).

# Security model

- Trusted project/storage roots are absolute, separate, real directories. Traversal, NUL bytes, symlink roots/ancestors, non-regular files, and outside paths are rejected.
- Source identity and SHA-256 digests are checked. Hard links are rejected by default; case/Unicode aliases are normalized and ambiguous multi-file paths fail closed.
- Approval, project identity, proposal membership, source/edit-set digests, policy/input digests, and transformation versions are bound into authorization. Explicit confirmation is required.
- Journals, receipts, evidence, and backups are durable records; backups are exclusive and hash-verified.
- Synced temporary-file replacement is not a power-loss atomicity claim. Recovery assessment is read-only and fails closed for stale identity, corrupt records, unreadable sources, unexpected digests, and mixed states.
- Cross-process locks use an exclusive directory and owner token. Existing locks, unavailable storage, and changed ownership fail closed; stale-lock behavior needs Windows verification.
- Windows reparse points, case-insensitive behavior, hard-link identity, rename durability, and process-kill behavior were exercised by the verified Windows suite where applicable; power-loss durability and active-attacker race resistance remain outside the supported guarantee.
- Multi-file transactions provide durable progress and recoverability, not true atomicity. Process-crash tests do not model sudden power loss.
- Fail-closed secure file access requires `O_NOFOLLOW`; unsupported Windows protected reads and Apply/Rollback operations reject before opening or mutating files. This does not eliminate path-swap races and does not enable Windows Apply/Rollback.

## Supported threat model and Windows scope

RTL Analyzer scans trusted local developer repositories. Active local filesystem attackers are outside the supported threat model, and race-free traversal is not guaranteed. Native Windows security adapters, C++/MSVC, the Windows SDK, and `NtCreateFile` are out of scope; the CLI remains JavaScript/TypeScript-based. Windows policy-backed scanning remains supported. Existing security restrictions must not be silently removed; behavior changes require separate approval.

## Verified Windows limitation

On the verified Windows runtime, `O_NOFOLLOW` is unavailable. Protected Apply/Rollback operations therefore reject with `UNSUPPORTED_SECURE_FILE_ACCESS` before opening or mutating protected files. Windows Apply/Rollback are intentionally unsupported; capability-gated functional tests are skipped only when the required secure-access capability is unavailable, and dedicated rejection contracts remain required.

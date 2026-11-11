# Security model

- Trusted project/storage roots are absolute, separate, real directories. Traversal, NUL bytes, symlink roots/ancestors, non-regular files, and outside paths are rejected.
- Source identity and SHA-256 digests are checked. Hard links are rejected by default; case/Unicode aliases are normalized and ambiguous multi-file paths fail closed.
- Approval, project identity, proposal membership, source/edit-set digests, policy/input digests, and transformation versions are bound into authorization. Explicit confirmation is required.
- Journals, receipts, evidence, and backups are durable records; backups are exclusive and hash-verified.
- Synced temporary-file replacement is not a power-loss atomicity claim. Recovery assessment is read-only and fails closed for stale identity, corrupt records, unreadable sources, unexpected digests, and mixed states.
- Cross-process locks use an exclusive directory and owner token. Existing locks, unavailable storage, and changed ownership fail closed; stale-lock behavior needs Windows verification.
- Windows reparse points, case-insensitive behavior, hard-link identity, rename durability, and process-kill behavior are unverified until M4D.3.
- Multi-file transactions provide durable progress and recoverability, not true atomicity. Process-crash tests do not model sudden power loss.

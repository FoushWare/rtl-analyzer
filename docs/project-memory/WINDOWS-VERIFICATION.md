# M4D.3 Windows verification checklist

Run from a fresh Windows import. Record Windows/Node/npm versions and exact output.

1. Install Node.js 22.12+, npm 10+, Python 3, and Chromium; run `npm ci`.
2. Run scanner typecheck/build/tests, package smoke, full typecheck/build, and portable E2E.
3. On NTFS, test junctions/reparse points in project and storage ancestors; they must be rejected or fail closed.
4. Test case-insensitive aliases and Unicode-normalization collisions; ambiguous paths must be rejected.
5. Test hard-linked source files; verify default rejection and explicit policy behavior.
6. Verify atomic replacement preserves content/mode and leaves no temporary file.
7. Start two real apply processes; one must lock and the other must fail with conflict.
8. Terminate a worker at each multi-file boundary, including after one replacement; fresh-process recovery assessment must be read-only.
9. Run the full regression again.

Acceptance: all suites pass; security fixtures fail closed as specified; recovery is deterministic and read-only; no secrets or generated artifacts are in the snapshot; no unexplained source/package differences remain.

Unverified until then: reparse-point edge cases, non-NTFS case behavior, file identity across volumes, power-loss durability, and antivirus/indexer interference.

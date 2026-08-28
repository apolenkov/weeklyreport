## 1. API repository terminal guards

- [x] 1.1 Reject non-completed or blank-metadata completion jobs before any Prisma update
- [x] 1.2 Make zero-count failure updates distinguish missing rows from idempotent terminal races
- [x] 1.3 Extend repository tests for invalid completion inputs, missing failure rows, and terminal no-ops

## 2. API processor artifact protocol

- [x] 2.1 Add the smallest overridable artifact filesystem seam for unique exclusive temp creation, durable writes, and directory synchronization
- [x] 2.2 Publish same-directory temp files without replacement, adopt only valid regular canonical files, reject symlinks, and hash canonical bytes with no-follow open
- [x] 2.3 Route completion through the actual canonical checksum and restrict all cleanup to attempt-owned temp files
- [x] 2.4 Add deterministic processor tests for concurrent byte interleavings, failure-after-publish, crash-before-CAS retry adoption, EEXIST, symlink rejection, and winner preservation

## 3. OpenSpec and verification

- [x] 3.1 Run focused repository, processor, and service tests and reconcile any causal failures
- [x] 3.2 Run the API unit suite, typecheck, scoped lint, formatting, diff checks, and strict OpenSpec validation
- [x] 3.3 Mark completed tasks, inspect the final diff/status, and create the second repair commit without push or merge

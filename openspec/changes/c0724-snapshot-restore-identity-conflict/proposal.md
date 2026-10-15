# Proposal

## Why

C0724 / C0707 (remaining clauses): admin targeted saves create reporting groups
and users with client-supplied ids outside the status-graph lane that serializes
snapshot restores. When such a save commits a row with an id that the restore is
about to insert, the restore's insert fails with a Prisma unique violation
(P2002). The restore transaction rolls back atomically, but the error reaches
the client as `INTERNAL_SERVER_ERROR` instead of the typed conflict that every
other live-data collision in restore already uses.

Backlog: TASK-503.103 (wave 4, candidates C0724 and C0707).

## What Changes

- `saveSnapshot` reports a unique violation from its restore transaction as
  `AdminSnapshotConflictError` (`CONFLICT`). Any other failure propagates
  unchanged; the rollback and the post-commit steps are untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-snapshot-restore`: a unique identity collision with a live row fails
  restore as a conflict.

## Impact

`apps/api/src/modules/admin/admin-snapshot-write.queries.ts` and its unit test.
No schema, migration or client change.

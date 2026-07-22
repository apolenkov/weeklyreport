# Fix Admin Snapshot Preserve isActive

## Why

`getSnapshot` reads each user's soft-deactivation flag
(`apps/api/src/modules/admin/admin-snapshot.queries.ts:68`,
`isActive: u.isActive`) and the shared `AdminSnapshot` schema carries it
(`packages/shared/src/schemas/report.schema.ts:116`), so the field is part of
the exported snapshot contract.

`upsertUsers` in `admin-snapshot-write.queries.ts` builds its `create` and
`update` data objects (lines 78–90 and 92–106) without `isActive` anywhere in
either. On a `getSnapshot` -> `saveSnapshot` restore, a user's stored
`isActive` value is silently dropped: the `update` branch leaves the
existing DB row's flag untouched (masking drift rather than restoring the
snapshot's value), and the `create` branch — restoring onto a fresh
database, or recreating a row that was deleted between snapshots — lands on
the column default (`true`). A deactivated user restored via the create
branch comes back active, reversing a deliberate access-control decision
(`deactivateUser`, `admin-entity-write.queries.ts:107-114`) without an
operator asking for it. This is a security-relevant data-integrity defect:
the read path exports the flag specifically to make deactivation visible in
a snapshot, and the write path throws it away.

## What Changes

- Add `isActive: user.isActive` to both the `create` and `update` data
  objects in `upsertUsers` (`admin-snapshot-write.queries.ts`), so a restore
  persists the snapshot's value on both branches instead of dropping it.
- Add a restore-roundtrip regression test: deactivate a seeded user, run
  `getSnapshot`, delete the user row (fresh-DB path), `saveSnapshot`, and
  assert the restored user's `isActive` is `false`; then restore the same
  snapshot into a DB where the user row already exists and is active, to
  cover the update branch.

## Capabilities

### Modified Capabilities

- `admin-snapshot-restore` — restoring a snapshot now preserves each user's
  `isActive` flag on both the create and update branch instead of dropping
  it to the column default.

## Impact

- Package: `@customreport/api`
- File: `apps/api/src/modules/admin/admin-snapshot-write.queries.ts`
  (`upsertUsers`)
- Tests: new case(s) in the api's admin snapshot integration test covering
  the restore roundtrip for `isActive`
- No schema change — `User.isActive` already exists and is already read by
  `getSnapshot`

## Non-goals

- Not touching `upsertGroups`, `upsertProjects`, `upsertPeriods`, or any
  other `upsert*` function in this file — no other field was found missing
  from their data objects in this finding.
- Not changing session revocation/restoration on deactivate/activate
  (`session-revocation.service.ts`) — this change only affects what
  `saveSnapshot` persists to the `User` row, not session lifecycle.
- Not changing the `AdminSnapshot` schema's `isActive: z.boolean().default(true)`
  — that default exists so pre-existing snapshot payloads without the field
  still parse; it is orthogonal to the write-path bug this change fixes.

## Findings covered

- `apps/api/src/modules/admin/admin-snapshot-write.queries.ts:92` —
  `upsertUsers` writes neither `create` nor `update` `isActive`, so a
  `getSnapshot -> saveSnapshot` round-trip drops the soft-deactivation flag
  and a deactivated user restored onto a fresh DB comes back active (DB
  default `true`), contradicting `getSnapshot` deliberately surfacing
  `isActive`. (opus-confirmed)

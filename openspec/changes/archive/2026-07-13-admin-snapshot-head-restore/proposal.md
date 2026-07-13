## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`saveSnapshot`'s `upsertGroups` (`apps/api/src/modules/admin/admin-snapshot-write.queries.ts`)
writes only `name`/`description`/`archived` on both the create and the update
branch — `headUserId` is never written. A fresh-DB snapshot import silently
drops every group's head assignment (the FK defaults `null`), and restoring
a snapshot into an existing DB can never apply a snapshot's changed
`headUserId` either. `headUserId` is confirmed load-bearing: it round-trips
through `getSnapshot`, and the targeted single-group path
(`saveReportingGroup` in `admin-group.queries.ts`) already writes it
correctly — only the whole-snapshot restore path is missing it. Groups are
upserted before users in `saveSnapshot`, so on `create` the referenced
`User` row for a group's head does not exist yet; that ordering constraint
is almost certainly why `headUserId` was left out in the first place.

There is no tRPC import endpoint that calls `saveSnapshot` today — only
integration tests reach it — so no user-triggerable path loses data yet.
That is why this is P2, not P1: the defect is real and confirmed, but dormant
until a snapshot-import surface ships.

## What Changes

- `apps/api/src/modules/admin/admin-snapshot-write.queries.ts`: add a second
  pass over `snapshot.groups` that runs after `upsertUsers` (so every head's
  `User` row is guaranteed to exist) and sets `reportingGroup.headUserId` for
  each group, including clearing it to `null` when the snapshot's group has
  no head. `upsertGroups` itself keeps writing `name`/`description`/`archived`
  only, on `create` and `update`, so the group row exists before the
  head-assignment pass runs against it.
- No change to `upsertUsers`, `upsertProjects`, `upsertPeriods`,
  `upsertReminderRules`, or the transaction boundary — the new pass runs
  inside the same `$transaction` as the rest of `saveSnapshot`, so a
  mid-write failure still rolls back the whole restore.

## Why

The `Report` model carries a comment promising a partial unique index
`Report_one_open_per_boundary`, but that index does not exist in the init
migration (`prisma/migrations/20260530162224_init/migration.sql`). The
"one open period per boundary" rule is therefore enforced only by an
application-level read-then-write (`findOverlappingPeriod` followed by a
bare `report.create`) with no transaction and no constraint-violation
catch. The auto-period scheduler racing a manual admin create, two API
instances, or two leads logging in for the first time in the same week can
all insert duplicate open periods for the same boundary, and the login path
(`ensureWeeklyReport`) has the same race surfacing as a 500. The schema
comment lies and there is no database backstop.

## What Changes

- Add the partial unique index `Report_one_open_per_boundary` on
  `("periodStart","periodEnd") WHERE "periodState" = 'open'` to the
  hand-written tail of the init migration, mirroring the existing
  `ReopenRequest_one_pending_per_section` precedent (MVP disposable-DB
  policy: reshape + `migrate reset`, no incremental alter-table migration).
- Update the `Report` schema comment so it states what is now true and
  names what stays application-level best-effort.
- Catch Prisma `P2002` on the index in the admin manual create/update path
  and translate it to the existing `AdminPeriodOverlapError`
  (→ `BAD_REQUEST`), instead of a 500, keeping `findOverlappingPeriod` as
  the friendly pre-check.
- Catch `P2002` in `ensureWeeklyReport` at login and re-read the existing
  draft report for the week instead of failing, so concurrent first-logins
  converge on one period.
- Make the `PeriodCreatorScheduler` `report.create` idempotent under the
  index: on `Report_one_open_per_boundary` `P2002` treat the tick as
  already-created (re-read or skip) instead of letting the cron throw, since
  the proposal names the scheduler race as one of the duplicate-period
  sources. Re-throw unrelated errors.
- Cover the remaining writers that MOVE an existing row into
  `periodState = 'open'` (the partial unique index constrains updates as
  well as inserts): the scheduler's `scheduled → open` flip
  (`updateMany`), `reopenPeriod`, and `unarchivePeriod`. After the index
  lands these can hit the same `P2002`; translate the admin lifecycle ones
  (`reopen` / `unarchive`) into the domain overlap error (→ `BAD_REQUEST`)
  and make the background `scheduled → open` flip degrade gracefully rather
  than surface a 500.

## Capabilities

### New Capabilities

- `period-uniqueness-constraint`: a database-level guard that at most one
  open `Report` exists per `(periodStart, periodEnd)` boundary, and the
  application paths that create periods translate its violation into a
  graceful outcome rather than a 500.

### Modified Capabilities

<!-- None. period-dual-state governs the periodState/legacy-tuple atomic
     write invariant (a different concern); schema-conventions governs Zod
     string-format validators. Neither covers period uniqueness/overlap. -->

## Impact

- `prisma/schema.prisma` (comment), `prisma/migrations/20260530162224_init/migration.sql` (new index).
- `apps/api/src/modules/admin/admin.prisma-repository.ts` / `admin-period.queries.ts` (P2002 catch on create/update).
- `apps/api/src/modules/auth/auth.routes.ts` (`ensureWeeklyReport` P2002 re-read).
- `apps/api/src/modules/period/period-creator.scheduler.ts` (the `report.create`
  and the `scheduled → open` `updateMany` P2002 handling).
- `apps/api/src/modules/period/period.prisma-repository.ts` (`reopenPeriod`) and
  `apps/api/src/modules/admin/admin-period.queries.ts` (`unarchivePeriod`) P2002
  → overlap-error translation.
- Requires `migrate reset` on `_dev` and `_test` databases (hand-edited index lands only via reset).

## Non-goals

- True cross-range overlap of distinct boundaries, and overlap involving a
  `scheduled` period, remain application-level best-effort
  (`findOverlappingPeriod`). A `btree_gist` exclusion constraint that would
  backstop those at the DB layer is a deferred alternative — the comment
  never promised it and it pulls in a new Postgres extension.
- No change to the period state machine's transition LOGIC, the field set
  `buildTransition` emits, or the `period-dual-state` invariant. The change
  only WRAPS the writers that move a row into `periodState = 'open'` with a
  `P2002` catch; it does not alter what they write on the success path.

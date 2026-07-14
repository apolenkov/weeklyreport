## 1. Guard the scheduled→open flip

- [x] 1.1 In `flipDueScheduledToOpen`, change the per-row
      `report.update({ where: { id: row.id }, ... })` to
      `report.updateMany({ where: { id: row.id, periodState: 'scheduled' }, data: buildTransition('open', {}) })`.
- [x] 1.2 Treat `count === 0` as a logged skip (mirror
      `auto-archiver.scheduler.ts`'s `count === 0` branch and log message
      style): the row was concurrently transitioned away from `scheduled`
      by another writer; do not retry or error.
- [x] 1.3 Keep the existing `P2002`/`isOpenBoundaryConflict` catch branch
      for the boundary-collision case (lines 54-70) — the new guard and the
      existing conflict recovery are independent concerns and both apply.
- [x] 1.4 Update the function's docblock (lines 22-33) to describe the
      guarded write and the new skip case.

## 2. Prevent duplicate `scheduled` rows per boundary

- [x] 2.1 Decide the mechanism: (a) broaden
      `Report_one_open_per_boundary` to also cover `scheduled` (e.g.
      `WHERE "periodState" IN ('open','scheduled')`, verify Postgres partial
      index syntax supports this), or (b) add a reconcile/delete-orphan step
      that removes a losing duplicate `scheduled` row once its boundary
      opens. Prefer (a) if the two-state predicate is expressible and does
      not conflict with any other lifecycle write that legitimately holds
      both a `scheduled` and an `open` row briefly (check `period-factory.ts`
      for any such window before committing to the index change).
- [x] 2.2 If (a): hand-edit
      `prisma/migrations/20260530162224_init/migration.sql` (the single init
      migration, edited directly per the MVP-phase rule) and the matching
      `prisma/schema.prisma` index annotation.
- [x] 2.3 N/A — mechanism (a) (broadened partial unique index) was chosen, so
      no orphan-reconcile step exists to implement.
- [x] 2.4 Correct `period-factory.ts`'s docstring "one row per boundary"
      claim to state the actual guarantee precisely.
- [x] 2.5 Test: two concurrent `ensureCurrentPeriod` calls (or scheduler
      ticks) for the same boundary never leave two `scheduled` rows (or, if
      they briefly do under mechanism (b), the orphan is reconciled away
      once one opens).

## 3. Test coverage for the guarded flip

- [x] 3.1 Test: a row concurrently archived (or otherwise transitioned away
      from `scheduled`) between the scan and the flip is NOT reset to
      `open`/`archived: false` — the flip's `updateMany` affects zero rows
      and the archive persists.
- [x] 3.2 Test: a row still `scheduled` at flip time transitions to `open`
      normally, unchanged from current behavior.
- [x] 3.3 Test: the existing boundary-collision (`P2002`) recovery path
      still logs and leaves the losing row `scheduled`, unchanged from
      current behavior — preservation test so this fix does not regress
      that path while touching the same function.

## 4. Spec delta

- [x] 4.1 `period-scheduler-wiring`: ADD a requirement that the
      scheduled→open flip is a guarded compare-and-set, not an unconditional
      update, and that duplicate scheduled rows per boundary cannot persist
      (see `specs/period-scheduler-wiring/spec.md` in this change).

## 5. Gates and verification

- [x] 5.1 `pnpm --filter @customreport/api db:generate`
- [x] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [x] 5.3 cd apps/api && pnpm test:integration
- [x] 5.4 If migration SQL changed: `prisma migrate reset` (per-DB) then
      re-run cd apps/api && pnpm test:integration
- [x] 5.5 `openspec validate period-scheduler-guarded-transitions --strict`

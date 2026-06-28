## 1. Schema + migration (prisma)

- [ ] 1.1 Add the partial unique index to the hand-written tail of
      `prisma/migrations/20260530162224_init/migration.sql`, after
      `ReopenRequest_one_pending_per_section`:
      `CREATE UNIQUE INDEX "Report_one_open_per_boundary" ON "Report"("periodStart","periodEnd") WHERE "periodState" = 'open';`
      with a comment matching the existing hand-written-index style.
- [ ] 1.2 Update the `Report` model comment in `prisma/schema.prisma`
      (~line 223) so it states the index now EXISTS, and add the best-effort
      caveat (true cross-range overlap and overlap involving non-open periods
      stay application-level via `findOverlappingPeriod`).
- [ ] 1.3 `prisma migrate reset` on the `_dev` database (with
      `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`), then `prisma generate`;
      confirm the index was created (`\d "Report"` / `pg_indexes`).
- [ ] 1.4 `prisma migrate reset` on the `_test` database independently
      (the hand-edited index lands only via reset, and `_test` resets do not
      follow `_dev`).

## 2. API — admin create/update P2002 translation

- [ ] 2.1 In the admin create path repository
      (`admin.prisma-repository.ts` / `admin-period.queries.ts::createPeriodManual`)
      wrap the `report.create` in try/catch; on
      `Prisma.PrismaClientKnownRequestError` with `code === "P2002"` targeting
      `Report_one_open_per_boundary`, throw `AdminPeriodOverlapError` with the
      same friendly message family as the pre-check; re-throw all other errors.
- [ ] 2.2 Apply the same `P2002` → `AdminPeriodOverlapError` catch to the
      manual update path's `report.update` (envelope-changed branch).
- [ ] 2.3 Confirm no `trpc.error-mapper.ts` change is needed
      (`AdminPeriodOverlapError` already maps to `BAD_REQUEST`); add a mapper
      test only if a gap is found.

## 3. API — ensureWeeklyReport recovery

- [ ] 3.1 In `apps/api/src/modules/auth/auth.routes.ts::ensureWeeklyReport`,
      wrap the `report.create` in try/catch; on the `Report_one_open_per_boundary`
      `P2002`, re-read by the index predicate — the `Report` on the computed week
      bounds with `periodState = 'open'` (NOT `status = 'draft'`, which misses a
      reopened-published blocker) — and continue with its id; re-throw any
      non-P2002 error unchanged.

## 3b. API — scheduler and lifecycle writers into 'open' (D5)

- [ ] 3b.1 In `apps/api/src/modules/period/period-creator.scheduler.ts`, wrap
      the `report.create` in try/catch; on the `Report_one_open_per_boundary`
      `P2002`, treat the tick as already-created (re-read the open period on the
      boundary or skip) and return a non-error outcome; re-throw any non-P2002
      error unchanged.
- [ ] 3b.2 In the same scheduler, guard the `scheduled → open` `updateMany`
      (~line 83) against the `Report_one_open_per_boundary` `P2002`: degrade
      gracefully (the boundary is already open) without crashing the tick;
      re-throw unrelated errors.
- [ ] 3b.3 In `reopenPeriod` (`apps/api/src/modules/period/period.prisma-repository.ts`)
      and `unarchivePeriod` (`apps/api/src/modules/admin/admin-period.queries.ts`),
      catch the `Report_one_open_per_boundary` `P2002` on the `report.update`
      and translate it to `AdminPeriodOverlapError` (→ `BAD_REQUEST`); re-throw
      all other errors. Assert on the index name so an unrelated unique
      violation re-throws.

## 4. Tests

- [ ] 4.1 Real-DB integration test (mirroring the reopen-request integration
      test): insert two open `Report` rows with identical `(periodStart, periodEnd)`
      against the `_test` DB; assert the second throws `P2002` referencing
      `Report_one_open_per_boundary`.
- [ ] 4.2 Admin-path test: a concurrent open-period insert defeats the
      `findOverlappingPeriod` pre-check; assert the create/update surfaces
      `AdminPeriodOverlapError` (→ `BAD_REQUEST`), not a 500. Prove teeth:
      removing the catch makes the test fail.
- [ ] 4.3 `ensureWeeklyReport` test: simulate the `P2002` on `report.create`;
      assert it re-reads by boundary + `periodState='open'` and returns the
      existing `reportId`; cover the reopened-period case (blocker has
      `status='published'`, `periodState='open'`) so a `status='draft'` re-read
      would fail the test; assert a non-P2002 error propagates unchanged.
- [ ] 4.4 Scheduler test: simulate the `Report_one_open_per_boundary` `P2002`
      on the scheduler's `report.create`; assert the tick converges to a
      non-error outcome (already-created) and does not throw; assert a
      non-P2002 error still propagates. Prove teeth: removing the catch makes
      the test fail.
- [ ] 4.5 Lifecycle test: simulate the `P2002` on `reopenPeriod` /
      `unarchivePeriod`'s `report.update`; assert each surfaces
      `AdminPeriodOverlapError` (→ `BAD_REQUEST`), not a 500; assert a
      non-P2002 error propagates unchanged.

## 5. Verification

- [ ] 5.1 Run the gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] 5.2 Run `pnpm format:check` for the OpenSpec markdown (Markdown is
      formatted, not markdown-linted — there is no `lint:md` script) and
      `openspec validate "period-uniqueness-db-constraint" --strict`.
- [ ] 5.3 Stage only this change's paths; do not commit unrelated parallel
      session work.

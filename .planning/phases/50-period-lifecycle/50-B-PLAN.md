# Phase 50-B — Three cron consumers + grace/late semantics

**Status:** ready
**Depends on:** 50-A (defaults must be wired so cron has values to read)
**Requirement:** Settings → реальная логика — make autoCreatePeriods, autoPublishAfterDeadline, autoArchiveWeeksAfterPublish, gracePeriodHours, allowLateSubmissions actually do something

## Goal

Three BullMQ recurring jobs (`period-creator`, `auto-publisher`,
`auto-archiver`) + submit-section middleware grace/late logic.
After this plan: every Period transition that can be automated IS
automated by the cron consumers reading AppSettings on every tick.

## Acceptance Criteria

- New file `apps/api/src/infrastructure/bullmq/period-creator.processor.ts`:
  - daily recurring job at 00:00 in `settings.defaultTimezone`
  - skips when `autoCreatePeriods=false`
  - finds most recent Period; if `periodEnd ≤ now` and no future
    Period exists, creates the next one (start = prevEnd + 1 day,
    length = periodLengthDays, deadline = +defaultDeadlineDays)
  - idempotent: re-runs same day → no-op
  - emits audit `period.auto-create`
- New file `apps/api/src/infrastructure/bullmq/auto-publisher.processor.ts`:
  - hourly recurring job
  - skips when `autoPublishAfterDeadline=false`
  - finds Periods where `status='draft' AND deadline +
gracePeriodHours INTERVAL < now`
  - calls `weekly-report.service.publish(reportId,
{ auto: true, byUserId: null })`
  - missing sections render as «Не сдал» placeholders at read time
    (no DB stub rows)
  - emits audit `period.auto-publish`
- New file `apps/api/src/infrastructure/bullmq/auto-archiver.processor.ts`:
  - daily recurring job
  - skips when `autoArchiveWeeksAfterPublish=0`
  - finds Reports where `status='published' AND archived=false AND
publishedAt + (weeks * 7 days) < now`
  - sets `archived=true` (new bool column on Report)
  - emits audit `period.auto-archive`
- Migration `<timestamp>_report_archived` adds
  `Report.archived: Boolean @default(false)` + index
  `@@index([archived, periodStart(sort: Desc)])`.
- Submit-section middleware enforces grace/late:
  - if `now > deadline + gracePeriodHours` AND
    `allowLateSubmissions=false` → throw TRPCError 403 'past-deadline'
  - if `now > deadline` (regardless of grace) → set
    `ReportSection.late=true` (new bool column on ReportSection,
    default false)
  - migration adds `ReportSection.late: Boolean @default(false)`
- UI shows «late» badge on ReportSection rows in head dashboard
  - lead form (new badge component).
- Audit-logger gains three new event types: `period.auto-create`,
  `period.auto-publish`, `period.auto-archive`.
- All existing tests stay green. New tests:
  - 3 unit tests per processor (skip-when-disabled, fire-when-eligible,
    idempotent)
  - 1 middleware test for grace+late combinations (2x2 matrix)
  - 1 audit-logger test for the new event types

## Steps

1. Schema additions in `prisma/schema.prisma`:

   ```prisma
   model Report {
     // …existing
     archived Boolean @default(false)
     @@index([archived, periodStart(sort: Desc)])
   }

   model ReportSection {
     // …existing
     late Boolean @default(false)
   }
   ```

2. Generate + apply migration:
   ```bash
   pnpm exec prisma migrate dev --name report_archived_section_late
   ```
3. Add audit-logger event types (mirror `scope-denied` pattern from
   Phase 46-05):
   ```ts
   periodAutoCreate({ periodId, periodStart, periodEnd, deadline }): void
   periodAutoPublish({ periodId, missingSectionsCount }): void
   periodAutoArchive({ periodId }): void
   ```
4. Create the three processors. Each gets:
   - `@Processor('queue-name')` class
   - `process()` method reading settings + executing the rule
   - `register()` helper called in app bootstrap to seed the
     repeatable job
5. Wire into `apps/api/src/app.module.ts` or wherever BullMQ modules
   are registered.
6. Submit-section middleware. Likely in
   `apps/api/src/modules/report-sections/`. Pattern:
   ```ts
   const settings = await orgService.getSettings();
   const now = Date.now();
   const deadline = report.deadline.getTime();
   const graceMs = settings.gracePeriodHours * 3_600_000;
   if (now > deadline + graceMs && !settings.allowLateSubmissions) {
     throw new TRPCError({ code: "FORBIDDEN", message: "Past deadline" });
   }
   const late = now > deadline;
   await prisma.reportSection.update({
     where: { id },
     data: { ...input, late },
   });
   ```
7. UI: add `<LateBadge />` component, render conditionally on
   `section.late` in head dashboard + lead form.
8. Tests as specified above.
9. Verify locally + Docker post-conditions:
   ```bash
   docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma generate"
   docker compose restart api
   ```
10. Manual smoke (compressed time for cron):
    - force-trigger PeriodCreator via `scripts/run-period-creator.ts`
      (write a small CLI wrapper)
    - same for AutoPublisher / AutoArchiver
    - submit a section past deadline → expect 403 or 200+late based
      on settings

## Verification Commands

```bash
docker exec customreport-redis-1 redis-cli KEYS 'bull:period-creator:*'
# expected: keys exist (job registered)

curl http://localhost:3002/metrics | grep -E "trpc_request_total{procedure=\"submit"
# (Phase 47-03 instrumentation) shows submit calls

pnpm --filter @customreport/api test -- period-creator auto-publisher auto-archiver
```

## Commit

`feat(api): UFB-049 — period lifecycle cron consumers + grace/late semantics (50-B)`

Body:

- Three BullMQ processors: period-creator, auto-publisher, auto-archiver
- Report.archived + ReportSection.late columns
- Submit-section middleware enforces grace + late flag
- Three new audit event types
- Co-Authored-By: Claude Opus 4.7 (1M context)

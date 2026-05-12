# Phase 50: Period Lifecycle — make Settings actually drive behavior

**Gathered:** 2026-05-10 (in-chat audit revealed 9/11 AppSettings are persisted+UI but have ZERO consumer logic)
**Status:** Ready for planning
**Mode:** Three independent plans (50-A / 50-B / 50-C), parallelizable
**Driver:** "все настройки теперь влияют на ход действий?" — answer was No. Out of 11 AppSettings fields, only `defaultTimezone` + `defaultReminderAudience` are wired (as prefill). The rest are decorative toggles.

<domain>
## Phase Boundary

Wire every existing AppSettings toggle into actual behavior. No new
fields in this phase — that's Phase 51. This phase makes the
Phase 48-B persistence layer real.

**50-A — Defaults wiring (low complexity, high coverage):**

- `defaultDeadlineDays` → Period.create uses it to compute deadline
  (currently hardcoded 4 in PeriodFactory / report seed). Wire the
  consumer in `weekly-report.service.ts` or wherever Period creation
  lives (verify via grep `reportPeriod.create` or `Report.create`).
- `periodLengthDays` → Period.create uses it to compute periodEnd =
  periodStart + (length - 1) days.
- `notificationFromEmail` → BullMQ email job reads from
  `OrganizationService.getSettings().notificationFromEmail`, replaces
  the hardcoded `reports@customreport.local` (verify hardcoded
  location with `grep -rn "@customreport.local"
apps/api/src/modules/email`).

**50-B — Cron consumers (the three big jobs):**

1. **PeriodCreator** — runs daily at 00:00 in `defaultTimezone`.
   - reads `AppSettings { autoCreatePeriods, periodLengthDays,
defaultDeadlineDays, defaultTimezone, workingDays }`
   - skips if `autoCreatePeriods=false`
   - finds the most recent open/scheduled Period
   - if its `periodEnd ≤ now`, creates the next Period:
     - periodStart = previousPeriodEnd + 1 day
     - periodEnd = periodStart + (periodLengthDays - 1) days
     - deadline = computeDeadline(periodStart, periodEnd,
       defaultDeadlineDays, workingDays, defaultTimezone) — see 50-C
   - emits audit `period.auto-create` event
   - idempotent: re-running the same day is a no-op

2. **AutoPublisher** — runs hourly.
   - skips if `autoPublishAfterDeadline=false`
   - finds Periods with `status=open` and
     `deadline + gracePeriodHours < now`
   - publishes them: status → `published`, publishedAt = now,
     publishedById = synthetic admin (or null + flag
     `autoPublished=true`)
   - missing ReportSections become «Не сдал» placeholders (visible
     in PDF and dashboard)
   - emits audit `period.auto-publish` event

3. **AutoArchiver** — runs daily.
   - skips if `autoArchiveWeeksAfterPublish=0`
   - finds Periods with `status=published` and `publishedAt +
(weeks * 7 days) < now`
   - marks them `archived=true` (new bool column on Report, default
     false; in-scope of this plan)
   - archived periods are excluded from the default `/archive` list
     unless admin toggles «Show archived»
   - emits audit `period.auto-archive` event

Plus middleware logic:

- `submit-section` middleware: if `deadline + gracePeriodHours < now`,
  block the submit unless `allowLateSubmissions=true`. If allowed,
  attach `late=true` flag on the ReportSection (new column,
  default false). UI shows «late» badge.

**50-C — workingDays + date utility:**

- New module `apps/api/src/lib/business-date.ts` with:
  - `nextBusinessDay(date, workingDays)` — adds 1 day, skipping
    weekends per workingDays enum.
  - `addBusinessDays(date, n, workingDays)` — adds n business days.
  - `isBusinessDay(date, workingDays)` — predicate.
- Replace every ad-hoc `+ 1 day` in Period date math with this
  utility, parameterised by `workingDays`.
- `computeDeadline(periodStart, periodEnd, deadlineDays, workingDays, tz)`
  semantics: start from periodStart in `tz`, advance `deadlineDays`
  business days, set time to deadlineTime (Phase 51 will make
  deadlineTime configurable; for now hardcode 18:00 in the given tz).

**Out of scope (Phase 51 covers):**

- Adding new AppSettings fields (firstDayOfWeek, deadlineDayOfWeek,
  deadlineTime, periodCadence, maxOpenPeriods, requireAllSectionsToPublish,
  allowReopenAfterPublish + reopenWindowHours).
- Period status state-machine refactor (5 states).
- Admin → Periods tab redesign with actions menu and submission
  progress badges.

</domain>

<decisions>
## Implementation Decisions

- **BullMQ over node-cron for the three consumers.** The project
  already uses BullMQ for `email-reminder` and `pdf-export`. Adding
  three more queues (`period-creator`, `auto-publisher`,
  `auto-archiver`) follows the existing pattern. Each queue gets a
  recurring repeatable job seeded at app boot.

- **`Report.archived: Boolean @default(false)`** — new column added in
  this phase, even though it logically belongs to «period model»
  (Phase 51). Reason: AutoArchiver in 50-B needs a place to write the
  flag NOW.

- **AutoPublisher with missing sections becomes «Не сдал» placeholder
  rows** — does NOT add stub ReportSection rows in DB. Rendering layer
  fills the gap at read time using the assigned User list (every
  reporting group lead with an assignment expected to file).

- **`gracePeriodHours=0` means «hard deadline»** — submit-section
  middleware blocks the moment `deadline < now`. AutoPublisher fires
  immediately at deadline tick.

- **`allowLateSubmissions=false` + `gracePeriodHours>0`** is a valid
  configuration. Grace applies to the AutoPublisher delay, but
  submissions are blocked at the deadline. Used by orgs that want
  «show late on dashboard for N hours, then auto-publish anyway».

- **50-A wires consumers but does NOT change semantics for existing
  data.** Existing Periods keep their current deadlines. New Periods
  created after this phase pick up the dynamic computation. No
  retroactive backfill.

- **50-B emits dedicated audit events** (`period.auto-create`,
  `period.auto-publish`, `period.auto-archive`) — not just generic
  `mutation`. Helps the action log show what cron did.

</decisions>

<code_context>

## Existing Code Insights

- BullMQ queues defined under `apps/api/src/infrastructure/bullmq/`
  (verify exact path). Each queue has a processor + a scheduler at
  app bootstrap. Mirror the existing `email-reminder.processor.ts`
  shape for the three new consumers.
- `AuditLogger` already supports event types like `policy.save`,
  `scope-denied`, `mutation`. Adding three new event types is a small
  surface — see `apps/api/src/lib/audit-logger.ts`.
- Period.create site: grep `prisma.report.create` or
  `prisma.reportPeriod.create` (Report IS the period model).
- Submit middleware: `apps/api/src/modules/report-sections/`
  likely has a `submit-section` mutation; that's where the
  grace-period block lives.
- Date math today uses raw `Date` + `+ 1 day`. Luxon is already
  installed (per 44-03). Use Luxon in `business-date.ts`.

</code_context>

## Verification Targets

After Phase 50:

```bash
# 1. defaults wired
docker exec customreport-postgres-1 psql -U customreport -d customreport \
  -c "UPDATE \"AppSettings\" SET \"periodLengthDays\"=14 WHERE id='singleton';"
# create a new Period via admin UI → assert periodEnd is periodStart + 13 days

# 2. cron fires
# wait for next 00:00 in defaultTimezone, observe a new Period was created
# OR force-trigger: pnpm --filter @customreport/api exec tsx scripts/run-period-creator.ts

# 3. late submission blocked
# set deadline to past, submit a section → expect 403 with reason 'past-deadline'
# OR allowLateSubmissions=true → expect 200 with late=true flag

# 4. auto-publish fires
# set autoPublishAfterDeadline=true + an overdue Period → wait 1h → assert
# Period.status=published with «Не сдал» placeholders for missing sections
```

## Acceptance Gate

Phase 50 closes when:

1. ✓ Changing AppSettings.periodLengthDays to 14 causes the NEXT
   created Period to span 14 days
2. ✓ PeriodCreator cron runs daily and creates the next Period when
   conditions match
3. ✓ Submitting a section past `deadline + gracePeriodHours` is
   blocked unless `allowLateSubmissions=true`
4. ✓ AutoPublisher fires for overdue Periods when toggle is on,
   places «Не сдал» placeholders
5. ✓ AutoArchiver flips `archived=true` after the configured weeks
6. ✓ Audit log shows the new period.auto-\* events
7. ✓ `business-date.ts` covers Mon-Fri / Mon-Sat / Mon-Sun
   correctly

# Phase 51-A — Period Model Expansion (schema + settings)

**Status:** ready
**Depends on:** Phase 50 (cron + grace logic baseline)
**Requirement:** 8 new AppSettings fields + 2 new Report flags + backfill migration

## Goal

Extend AppSettings with `firstDayOfWeek`, `deadlineDayOfWeek`,
`deadlineTime`, `periodCadence`, `maxOpenPeriods`,
`requireAllSectionsToPublish`, `allowReopenAfterPublish`,
`reopenWindowHours`. Add `autoPublished` + `autoArchived` flags to
Report. Backfill migration converts current `defaultDeadlineDays` to
`deadlineDayOfWeek` derivation. Wire consumers in 50-B cron jobs

- publish/reopen service methods.

## Acceptance Criteria

- Prisma schema additions on `AppSettings`:
  - `firstDayOfWeek: FirstDayOfWeek @default(MONDAY)` — new enum
  - `deadlineDayOfWeek: Int @default(5)` (1=Mon..7=Sun ISO)
  - `deadlineTime: String @default("18:00")` (HH:MM in defaultTimezone)
  - `periodCadence: PeriodCadence @default(WEEKLY)` — new enum
    (`WEEKLY | BI_WEEKLY`)
  - `maxOpenPeriods: Int @default(1)`
  - `requireAllSectionsToPublish: Boolean @default(true)`
  - `allowReopenAfterPublish: Boolean @default(true)`
  - `reopenWindowHours: Int @default(48)`
- Prisma schema additions on `Report`:
  - `autoPublished: Boolean @default(false)`
  - `autoArchived: Boolean @default(false)`
- Migration backfills `deadlineDayOfWeek` from `defaultDeadlineDays`:
  `(periodStart.weekday + defaultDeadlineDays - 1) % 7 + 1`
- `defaultDeadlineDays` stays as legacy column for one release; new
  Period.create reads `deadlineDayOfWeek` + `deadlineTime`.
- Shared zod `appSettingsSchema` extended with all 8 new fields +
  defaults matching SQL. Two new enum schemas:
  - `firstDayOfWeekSchema = z.enum(['monday', 'sunday'])`
  - `periodCadenceSchema = z.enum(['weekly', 'bi-weekly'])`
- Wire ↔ Prisma enum mappers for `FirstDayOfWeek` + `PeriodCadence`
  (mirror existing `WorkingDays` mapper from 48-B).
- tRPC `admin.getSettings` / `admin.updateSettings` round-trip new
  fields.
- Settings UI Periods tab gains the new inputs:
  - firstDayOfWeek: 2-radio
  - deadlineDayOfWeek: 7-day selector
  - deadlineTime: time input
  - periodCadence: 2-radio
  - maxOpenPeriods: number (1..4)
  - requireAllSectionsToPublish: toggle
  - allowReopenAfterPublish: toggle (+ disable child)
  - reopenWindowHours: number (0..168), greyed when toggle off
- 50-B cron jobs read the new fields:
  - PeriodCreator respects `periodCadence` (BI_WEEKLY = +14d, not 7)
  - PeriodCreator enforces `maxOpenPeriods` (skip if N already open)
  - AutoPublisher / AutoArchiver pick up `autoPublished` /
    `autoArchived` flags on the rows they touch
- weekly-report.service.publish enforces `requireAllSectionsToPublish`
  (throw if not all submitted, unless explicit `force=true`)
- weekly-report.service.reopen enforces
  `allowReopenAfterPublish && now <= publishedAt + reopenWindowHours`

## Steps

1. Schema edits per acceptance.
2. Generate migration:
   ```bash
   pnpm exec prisma migrate dev --name period_model_expansion
   ```
3. Hand-edit migration to append the deadlineDayOfWeek backfill:
   ```sql
   UPDATE "AppSettings"
   SET "deadlineDayOfWeek" = (
     -- assuming firstDayOfWeek=monday default, periodStart=monday,
     -- deadlineDayOfWeek = 1 + (defaultDeadlineDays % 7)
     ((1 + COALESCE("defaultDeadlineDays", 4) - 1) % 7) + 1
   )
   WHERE id = 'singleton';
   ```
4. Apply + regenerate Prisma client (host + container).
5. Shared zod additions in `packages/shared/src/schemas/report.ts`.
6. Backend service additions:
   - Update `admin.prisma-repository.ts` to read/write new fields
   - Update PeriodCreator (50-B) to use cadence + maxOpenPeriods
   - Update publish() to enforce requireAllSectionsToPublish
   - Update reopen() to enforce window
7. UI: Settings tab Periods sub-tab additions (5+ new inputs).
8. Tests:
   - Contract: zod parses, rejects out-of-range
   - Service: publish gating, reopen gating
   - Cron: PeriodCreator respects cadence + maxOpenPeriods
9. Verify + Docker post-conditions.

## Verification

```bash
docker exec customreport-postgres-1 psql -U customreport -d customreport \
  -c "\d \"AppSettings\""
# expected: all 8 new columns visible

pnpm --filter @customreport/api test -- period-creator publish reopen
```

## Commit

`feat(api,web,shared): UFB-051 — Period model expansion (8 settings + 2 Report flags) (51-A)`

Co-Authored-By: Claude Opus 4.7 (1M context)

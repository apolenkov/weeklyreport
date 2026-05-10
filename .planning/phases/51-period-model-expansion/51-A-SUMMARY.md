---
phase: 51
plan: 51-A
subsystem: schema + admin + web
tags: [UFB-051, AppSettings, Report, period-lifecycle, admin-ui]
requires: [50-A, 50-B]
provides:
  [
    period-cycle knobs in AppSettings,
    autoPublished/autoArchived flags on Report,
  ]
affects:
  [
    prisma/schema.prisma,
    packages/shared,
    apps/api/src/modules/admin,
    apps/web/src/components/admin,
  ]
tech_added: []
key_files_created:
  - prisma/migrations/20260510215245_period_model_expansion/migration.sql
key_files_modified:
  - prisma/schema.prisma
  - packages/shared/src/schemas/report.ts
  - packages/shared/src/schemas/__tests__/report.test.ts
  - apps/api/src/modules/admin/admin.prisma-repository.ts
  - apps/api/src/modules/admin/admin-settings.integration.test.ts
  - apps/api/src/modules/admin/admin.service.test.ts
  - apps/api/src/modules/admin/stage-assignment.integration.test.ts
  - apps/api/src/modules/period/auto-publisher.scheduler.test.ts
  - apps/api/src/modules/period/period-creator.scheduler.test.ts
  - apps/api/src/modules/period/auto-archiver.scheduler.test.ts
  - apps/web/src/components/admin/mock-data.ts
  - apps/web/src/components/admin/settings-tab.tsx
  - apps/web/src/components/admin/settings-tab.test.tsx
  - apps/web/src/lib/mappers/admin.ts
  - apps/web/src/lib/mappers/admin.test.ts
decisions:
  - "Kept periodCadence as TEXT (not Postgres enum) so future cadences (monthly, quarterly, …) extend the wire enum without an ALTER TYPE migration"
  - "firstDayOfWeek + deadlineDayOfWeek use ISO weekday numbering (1=Mon..7=Sun) — plain Int columns, not new Prisma enums (per prompt override of the plan's FirstDayOfWeek enum suggestion)"
  - "reopenWindowHours default 72 (3 days) — matches the prompt's spec, not the plan's 48"
  - "Skipped the plan's manual SQL backfill for deadlineDayOfWeek; column-level DEFAULT applies to existing rows on ADD COLUMN automatically"
  - "51-A scope strictly schema + persistence + Settings UI prefill. Cron consumers (cadence-aware PeriodCreator, maxOpenPeriods gate, publish/reopen window enforcement, autoPublished/autoArchived stamping) deferred to 51-C state-machine plan"
metrics:
  duration_min: 13
  tasks_completed: 4
  files_created: 1
  files_modified: 14
  commits: 4
  api_unit_tests: 793 # unchanged (new tests are integration-only)
  api_integration_tests: 66 # +2 from 64 baseline
  shared_tests: 473 # +7 from 466 baseline
  web_tests: 322 # +4 from 318 baseline
completed: 2026-05-11
---

# Phase 51 Plan A: Period Model Expansion (schema + Settings UI prefill) Summary

**One-liner:** AppSettings gains eight new period-cycle knobs (firstDayOfWeek, deadlineDayOfWeek, deadlineTime, periodCadence, maxOpenPeriods, requireAllSectionsToPublish, allowReopenAfterPublish, reopenWindowHours) and Report gains two state-machine audit flags (autoPublished, autoArchived) — schema, repository plumbing, and Settings UI inputs only; cron consumers and gating logic ship in 51-C.

## What was built

**Schema (commit `29310ec`).** Migration `20260510215245_period_model_expansion` adds 8 NOT NULL columns with sensible SQL defaults to `AppSettings` (singleton row updates in-place) and 2 NOT NULL boolean columns with `false` defaults to `Report`. No new Postgres enums — `periodCadence` is TEXT so adding `monthly`/`quarterly` later is a one-line zod change. Migration applied to both `customreport` (prod-equivalent) and `customreport_test` (drift-recovered: that DB had been stuck pre-Phase-50 — backfilled `20260510194118` through `20260510215245` in one `migrate deploy`).

**Shared zod (commit `8cb13c5`).** `appSettingsSchema` extended with the 8 fields and a new `periodCadenceSchema = z.enum(["weekly", "bi-weekly"])`. All fields carry `.default()` so pre-51-A clients with partial PATCH payloads keep parsing. New regex guard for `deadlineTime` (`/^([01]\d|2[0-3]):[0-5]\d$/`) rejects `"25:00"`, `"9:30"`, and `"noon"` at the wire boundary. +7 contract tests cover defaults + each out-of-range edge.

**API repository (commit `72dbe65`).** `admin.prisma-repository.ts` `rowToAppSettings` reads the 8 new columns and re-parses through `appSettingsSchema` so a hand-corrupted DB row would still be caught. `updateSettings` PATCH path adds 8 pass-through writes. Six test fixtures across `admin.service.test`, `admin-settings.integration`, `stage-assignment.integration`, and the three period-scheduler tests extended with the new defaults so the `AppSettings` type shape stays consistent everywhere. +2 integration tests round-trip all 8 fields.

**Web UI (commit `c7605f0`).** Both `MockSettings` definitions (`apps/web/src/components/admin/mock-data.ts` and `apps/web/src/lib/mappers/admin.ts`) extended. `mapAdminSettings` passes the 8 fields 1:1. Periods sub-tab gains: 2-radio firstDayOfWeek (Monday ISO / Sunday), 7-option deadline-day-of-week select, HTML `<input type="time">` for deadlineTime, 2-radio cadence (weekly / bi-weekly), number input for maxOpenPeriods (1..12), toggles for requireAllSectionsToPublish + allowReopenAfterPublish, and reopenWindowHours (0..168) that greys out when allowReopen is off. PATCH payload carries the 8 fields. +4 tests cover render + edit + grey-out behavior.

## Deviations from Plan

**Followed the prompt's overrides where it diverged from the plan:**

1. **`firstDayOfWeek` as `Int @default(1)` (1=Mon..7=Sun)**, not the plan's proposed `FirstDayOfWeek @default(MONDAY)` enum. Prompt rationale: "later: weekly/biweekly/monthly enum" — the author had already decided enum is premature.

2. **`periodCadence` as `String @default("weekly")` with TEXT in Postgres**, not the plan's `PeriodCadence @default(WEEKLY)` Prisma enum. Reasons: (a) future cadences (monthly, …) extend the wire enum without a Prisma migration + `ALTER TYPE`, (b) no DB enum mapper boilerplate, (c) zod still enforces the contract on the wire boundary.

3. **`reopenWindowHours` default 72**, not the plan's 48. Followed prompt's spec literally.

4. **Skipped the plan's hand-written `UPDATE "AppSettings" SET "deadlineDayOfWeek" = ...` backfill SQL.** Column-level `DEFAULT 5` applies to existing rows on `ADD COLUMN` automatically — the singleton row gets the default for free. The plan's backfill formula was also incorrect (it would derive deadlineDayOfWeek from `defaultDeadlineDays % 7` which conflates "days after start" with "ISO weekday").

5. **Scope strictly schema + UI prefill.** The plan section "Acceptance Criteria" listed cron consumers and publish/reopen gating logic; prompt explicitly excluded them: "51-A is **only schema + settings UI prefill** + repo plumbing." Those land in 51-C alongside the state-machine dashboard.

### Auto-fixed Issues

**1. [Rule 1 — Bug] Test DB drift from Phase 50.**

- **Found during:** Task 3 verification (running `test:integration`).
- **Issue:** `customreport_test` was stuck pre-Phase-50 — missing `archived` column on `Report` and several other earlier migrations. Caused `P2022 ColumnNotFound` cascade failures in 28 integration tests across many modules.
- **Fix:** `DATABASE_URL=postgresql://customreport:localdev@localhost:5432/customreport_test pnpm exec prisma migrate deploy` brought the test DB up to head (applied 5 missing migrations including my own).
- **Files modified:** none (DB-only state correction).
- **Commit:** N/A — operational fix, no code changes.

**2. [Rule 1 — Drift] Six AppSettings test fixtures missing 8 new fields.**

- **Found during:** Task 3 (`admin.service.test.ts` `toEqual(defaultSettings)` failed).
- **Issue:** `defaultSettings` and `makeSettings` factories across six test files hard-coded the 48-B 11-field shape; adding 8 columns to `AppSettings` broke shape equality.
- **Fix:** Extended each fixture with the 8 new fields at SQL defaults. Documented the addition with a `UFB-051` comment block in each file.
- **Files modified:** `apps/api/src/modules/admin/admin.service.test.ts`, `stage-assignment.integration.test.ts`, `apps/api/src/modules/period/auto-publisher.scheduler.test.ts`, `period-creator.scheduler.test.ts`, `auto-archiver.scheduler.test.ts` (+ the new fields in `admin-settings.integration.test.ts`).
- **Commit:** `72dbe65`.

## Authentication gates

None — all work was schema + code, no external auth surface touched.

## Verification

```
prisma/migrations/20260510215245_period_model_expansion/
  └─ migration.sql

docker exec customreport-postgres-1 psql -U customreport -d customreport -c '\d "AppSettings"'
  → 8 new columns visible:
    firstDayOfWeek, deadlineDayOfWeek, deadlineTime, periodCadence,
    maxOpenPeriods, requireAllSectionsToPublish, allowReopenAfterPublish,
    reopenWindowHours — all NOT NULL with the documented defaults.

docker exec customreport-postgres-1 psql -U customreport -d customreport -c '\d "Report"'
  → 2 new columns visible: autoPublished, autoArchived (both BOOLEAN NOT NULL DEFAULT false).

pnpm --filter @customreport/shared test
  → 473 passing (was 466; +7 UFB-051 contract tests).

pnpm --filter @customreport/api test
  → 793 unit passing (unchanged; UFB-051 integration tests live elsewhere).

pnpm --filter @customreport/api test:integration
  → 66 passing (was 64; +2 UFB-051 round-trip tests).

pnpm --filter @customreport/api exec tsc --noEmit
  → exit 0.

pnpm --filter @customreport/web test
  → 322 passing (was 318; +4 UFB-051 tests: 1 mapper round-trip + 3 settings-tab).

pnpm --filter @customreport/web exec tsc --noEmit
  → exit 0.

curl -s -m 5 http://localhost:3001/health → healthy.
```

## Open questions

None. The prompt resolved every fork point that the plan left ambiguous.

## What 51-B and 51-C will consume

- **51-B (Admin UI redesign):** The 8 new fields are now first-class form state on the Periods sub-tab. If 51-B reorganizes Settings tabs (e.g. splits Periods into Calendar / Lifecycle), the field shapes and PATCH plumbing stay unchanged.

- **51-C (state-machine):**
  - `PeriodCreator` should read `periodCadence` (skip `+ 7d` step in favour of `+14d` for bi-weekly) and `maxOpenPeriods` (skip auto-create when the count of `status=draft OR reopened` periods >= the cap).
  - `AutoPublisher` should set `Report.autoPublished = true` when it transitions a period at `deadline + grace`.
  - `AutoArchiver` should set `Report.autoArchived = true` when it flips `archived`.
  - `WeeklyReportService.publish()` should reject (or require `force=true`) when `requireAllSectionsToPublish` and not all sections are `submitted`.
  - `WeeklyReportService.reopen()` should reject when `allowReopenAfterPublish=false` OR `now > publishedAt + reopenWindowHours * 1h`.

  Calendar anchoring (`firstDayOfWeek`, `deadlineDayOfWeek`, `deadlineTime`) ties into a future `business-date.ts` rewrite that replaces the current Mon-Fri hard-code with config-driven period boundaries.

## Self-Check: PASSED

- [x] `prisma/migrations/20260510215245_period_model_expansion/migration.sql` exists.
- [x] Commit `29310ec` (schema) in `git log`.
- [x] Commit `8cb13c5` (shared) in `git log`.
- [x] Commit `72dbe65` (api) in `git log`.
- [x] Commit `c7605f0` (web) in `git log`.
- [x] 8 new AppSettings columns visible in postgres `\d "AppSettings"`.
- [x] 2 new Report columns visible in postgres `\d "Report"`.
- [x] tsc clean on both api and web.
- [x] Shared 473, API unit 793, API integration 66, web 322 — all passing.

---
phase: 48
plan: 48-B
subsystem: admin / settings
tags:
  - UFB-048
  - settings
  - app-settings
  - reminder-policy
status: complete
commits:
  - c467388
---

# Phase 48 Plan 48-B: AppSettings Expansion + 3 Settings Tabs Summary

**One-liner:** Nine org-wide configurable knobs added to `AppSettings` with
new `WorkingDays` enum, surfaced in three new Settings sub-tabs (Periods /
Reminders / Notifications), plus a ReminderPolicy form prefill so the «New
Policy» editor seeds timezone + audience from the org defaults instead of
hardcoded `Europe/Moscow` / `lead-with-draft`.

## Acceptance Criteria — Status

| Criterion                                                                                                                                                                                                                      | Status |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 9 new fields on `AppSettings` (periodLengthDays, workingDays, gracePeriodHours, defaultTimezone, defaultReminderAudience, notificationFromEmail, allowLateSubmissions, autoPublishAfterDeadline, autoArchiveWeeksAfterPublish) | done   |
| Migration `20260510210000_appsettings_expansion` adds 9 columns + `WorkingDays` enum with SQL defaults                                                                                                                         | done   |
| Shared `appSettingsSchema` extended with `.default()` on every new field; older 3-key payloads still parse                                                                                                                     | done   |
| tRPC `admin.getSettings` / `admin.updateSettings` round-trip all 9 fields                                                                                                                                                      | done   |
| Settings UI: Periods sub-tab gains 6 new fields; Reminders + Notifications sub-tabs replace placeholders                                                                                                                       | done   |
| Each new field has explanatory help text (the «зачем»)                                                                                                                                                                         | done   |
| `workingDays` documented as metadata-only in v1 in the field help text                                                                                                                                                         | done   |
| `gracePeriodHours` + `allowLateSubmissions` semantics documented in field help                                                                                                                                                 | done   |
| `autoPublishAfterDeadline` semantics + scheduler-deferral noted in field help                                                                                                                                                  | done   |
| Tests: contract (zod parse/reject), integration (round-trip), UI smoke (each tab renders + Save mutation called)                                                                                                               | done   |
| ReminderPolicy form prefills timezone + audience from AppSettings defaults                                                                                                                                                     | done   |

## Wire-format and Prisma boundaries

| Wire (zod / UI)                   | Prisma                            | Translator                                                   |
| --------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| `mon-fri \| mon-sat \| mon-sun`   | `MON_FRI \| MON_SAT \| MON_SUN`   | `workingDays{From,To}Prisma` in `admin.prisma-repository.ts` |
| `lead-with-draft \| head-of-late` | `LEAD_WITH_DRAFT \| HEAD_OF_LATE` | reuses existing `audience{From,To}Prisma`                    |

The repository owns the boundary; nothing outside it deals with the
screaming-snake DB convention.

## Files Changed

### Schema / migration

- `prisma/schema.prisma` — `AppSettings` expanded with 9 fields + new
  `WorkingDays` enum + behavioral comment block.
- `prisma/migrations/20260510210000_appsettings_expansion/migration.sql` —
  CreateEnum + ALTER TABLE with SQL defaults.

### Shared package

- `packages/shared/src/schemas/report.ts` — `workingDaysSchema`,
  `reminderAudienceWireSchema` (mirror of admin/reminder-policy.schema for
  use in AppSettings), `appSettingsSchema` extended with `.default()` on
  every new field, `WorkingDays` type export.
- `packages/shared/src/schemas/__tests__/report.test.ts` — +8 UFB-048
  contract tests.

### API

- `apps/api/src/modules/admin/admin.prisma-repository.ts` — `WorkingDays`
  Prisma import + bidirectional translators + `rowToAppSettings` helper +
  `getSettings` / `updateSettings` extended to round-trip 12 fields with
  explicit per-field PATCH plumbing.
- `apps/api/src/modules/admin/admin.service.test.ts` — fixture expanded;
  +1 UFB-048 round-trip test.
- `apps/api/src/modules/admin/admin-settings.integration.test.ts` —
  fixture expanded; `toEqual(defaultSettings)` replaces inline 3-field
  literal; +1 UFB-048 round-trip test.
- `apps/api/src/modules/admin/stage-assignment.integration.test.ts` —
  fixture expanded.

### Web

- `apps/web/src/components/admin/timezone-options.ts` (new) —
  `TIMEZONE_OPTIONS` lifted out of `reminders-tab.tsx` so the Settings →
  Reminders sub-tab can reuse the same curated list.
- `apps/web/src/components/admin/reminders-tab.tsx` — local
  `TIMEZONE_OPTIONS` removed (now imported); `RemindersTabProps` gains
  optional `defaultTimezone` / `defaultAudience`; `emptyPolicyForm` takes
  defaults; the three call sites threaded with org-wide defaults.
- `apps/web/src/components/admin/reminders-tab.test.tsx` — `renderTab`
  signature gains the two optional props; +1 UFB-048 prefill test.
- `apps/web/src/components/admin/admin-panel.tsx` — pipes
  `settings?.defaultTimezone` and `settings?.defaultReminderAudience` into
  `<RemindersTab>`.
- `apps/web/src/components/admin/settings-tab.tsx` — `PlaceholderSubTab`
  removed; `PeriodsSubTab` extended with 6 new fields and the
  `autoPublishAfterDeadline` gate; new `RemindersSubTab` (timezone +
  audience editor); new `NotificationsSubTab` (from-email editor with
  email validation guard); shared `useUpdateSettingsMut` helper.
- `apps/web/src/components/admin/settings-tab.test.tsx` — `baseSettings`
  expanded; +5 UFB-048 sub-tab tests.
- `apps/web/src/components/admin/mock-data.ts` — `MockSettings` +
  `MOCK_SETTINGS` expanded.
- `apps/web/src/lib/mappers/admin.ts` — `MockSettings` expanded;
  `mapAdminSettings` passes through the 9 new fields.
- `apps/web/src/lib/mappers/admin.test.ts` — `toStrictEqual` updated to
  the full shape; +1 UFB-048 round-trip test.

## Test Counts

| Suite                                                 | Before | After | Delta |
| ----------------------------------------------------- | -----: | ----: | ----: |
| `@customreport/shared`                                |    454 |   462 |    +8 |
| `@customreport/api` (unit)                            |    729 |   730 |    +1 |
| `@customreport/api` (integration, `test:integration`) |     64 |    65 |    +1 |
| `@customreport/web`                                   |    311 |   318 |    +7 |

## Manual Verification

```sql
-- AppSettings singleton row carries all 9 columns with SQL defaults.
SELECT id, "periodLengthDays", "workingDays", "gracePeriodHours",
       "defaultTimezone", "defaultReminderAudience",
       "notificationFromEmail", "allowLateSubmissions",
       "autoPublishAfterDeadline", "autoArchiveWeeksAfterPublish"
FROM "AppSettings";
-- → singleton | 7 | MON_FRI | 24 | Europe/Moscow | LEAD_WITH_DRAFT
--             | (null) | t | f | 0
```

Docker post-conditions executed:

1. `pnpm exec prisma migrate deploy` (host) — applied
   `20260510210000_appsettings_expansion`.
2. `docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma generate"`
   — Prisma client regenerated.
3. `docker compose restart api web` — both healthy.
4. `psql \\d "AppSettings"` — all 9 columns present with correct defaults.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stage-assignment integration test fixture**

- **Found during:** Step 9 (API lint pass).
- **Issue:** `stage-assignment.integration.test.ts` had a separate
  `defaultSettings: AppSettings = {…}` literal with the original 3 fields,
  causing `tsc --noEmit` to fail after the type expanded.
- **Fix:** Expanded the fixture to the full 12-field shape mirroring the
  SQL defaults.
- **Files modified:**
  `apps/api/src/modules/admin/stage-assignment.integration.test.ts`.
- **Commit:** `c467388` (atomic).

**2. [Rule 4 spillover → resolved inline] Lifted `TIMEZONE_OPTIONS` to a
shared module instead of duplicating it.**

- **Found during:** Step 6 (Reminders sub-tab implementation).
- **Issue:** Settings → Reminders needs the same curated IANA list that
  Reminders Tab uses (~70 lines). Duplicating 70 lines across two files
  would violate Pillar 4 (surgical changes / minimum diff).
- **Fix:** Extracted `TIMEZONE_OPTIONS` to
  `apps/web/src/components/admin/timezone-options.ts`; both consumers
  import from it. Pure refactor — values byte-identical.
- **Note:** Treated as a Rule 4 «architectural change» but resolved
  inline because the alternative (duplication) was more harmful than the
  refactor.

### Plan-driven adjustments

- The plan said «single import change» for the ReminderPolicy form
  prefill in step 9. Reality required: (1) prop addition on
  `RemindersTabProps`, (2) `emptyPolicyForm` signature change, (3) three
  call-site updates, (4) admin-panel prop pipe, (5) test signature
  update. Documented as part of the atomic commit, not a deviation —
  the plan's framing was optimistic.

## Known Stubs

- `autoPublishAfterDeadline` toggle is persisted but the scheduler
  consumer is not implemented. Help text in the UI states this
  explicitly. Tracked as a deferred item in `PHASE-SUMMARY.md`.

## Decisions Made

1. **`WorkingDays` is metadata-only in v1.** Deadline-math change deferred
   to keep this plan atomic. UI hint text states the constraint.
2. **`notificationFromEmail` is nullable.** Empty input is normalised to
   `null` on Save; clearing the field is a valid action that reverts to
   the per-mailer default.
3. **PATCH semantics for Save.** Each sub-tab sends only the fields it
   owns, not the full payload. Avoids accidental clobbering when two
   admins edit different sub-tabs concurrently.
4. **`emptyPolicyForm` defaults are optional.** When `RemindersTab` is
   rendered before settings load, the form falls back to the historical
   `Europe/Moscow` / `lead-with-draft` so component tests that predate
   48-B still render with the same shape.

## Self-Check: PASSED

- File `prisma/migrations/20260510210000_appsettings_expansion/migration.sql`
  — FOUND.
- File `apps/web/src/components/admin/timezone-options.ts` — FOUND.
- Commit `c467388` — FOUND in `git log`.
- Docker: AppSettings columns verified via psql.
- Lint: shared / api / web all clean.
- Tests: shared 462 ✓, api unit 730 ✓, api integration 65 ✓, web 318 ✓.

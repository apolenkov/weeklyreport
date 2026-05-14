---
phase: 16-backend-hardening
plan: 01
subsystem: database
tags: [prisma, migration, zod, postgresql, schema-alignment]

# Dependency graph
requires:
  - phase: 14-backend-hardening-containerization
    provides: "Prisma schema with ReminderRule model and init migration"
provides:
  - "ReminderRule table with kind/fireAt/timezone/status/version columns"
  - "Zod adminReminderRuleSchema with nullable reportId"
  - "Zod adminReminderExecutionSchema with nullable reportId"
  - "Safe data-preserving migration SQL pattern"
affects: [16-02, 16-03, 16-04, reminders, admin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    ["hand-edited Prisma migration with UPDATE before DROP for data safety"]

key-files:
  created:
    - "prisma/migrations/20260421164918_align_reminder_rule_schema/migration.sql"
  modified:
    - "packages/shared/src/schemas/report.ts"
    - "apps/api/src/modules/reminders/reminders.prisma-repository.ts"
    - "apps/api/src/modules/admin/admin.prisma-repository.ts"
    - "apps/api/src/modules/admin/admin.integration.test.ts"
    - "apps/api/src/modules/reminders/reminders.integration.test.ts"

key-decisions:
  - "Hand-edited migration SQL with UPDATE before DROP to prevent data loss (v4-P3 pitfall)"
  - "Made adminReminderExecutionSchema.reportId nullable alongside adminReminderRuleSchema (Rule 2 deviation)"

patterns-established:
  - "Data-safe migration pattern: ADD columns with defaults -> UPDATE data -> DROP old columns -> remove defaults"
  - "Nullable foreign keys pass null not fake UUIDs through Zod schemas"

requirements-completed: [BE-01]

# Metrics
duration: 8min
completed: 2026-04-21
---

# Phase 16 Plan 01: Prisma ReminderRule Migration & Zod Alignment Summary

**Hand-edited Prisma migration aligning ReminderRule schema (kind/fireAt/timezone/status/version), nullable reportId in Zod schemas, and removal of all fake UUID fallbacks in repository mappings**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-21T16:47:43Z
- **Completed:** 2026-04-21T16:55:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created safe hand-edited Prisma migration that converts ReminderRule data before dropping old columns
- Fixed Zod schema nullability mismatch for reportId in both rule and execution schemas
- Removed all fake UUID fallbacks ('00000000-0000-0000-0000-000000000000') from repository mapping functions
- Updated integration tests to use new ReminderRule fields (kind/fireAt/timezone/status/version)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Prisma migration with hand-edited data conversion SQL** - `a7a29d9` (feat)
2. **Task 2: Fix Zod reportId nullability and update repository mappings** - `79ad44b` (fix)

## Files Created/Modified

- `prisma/migrations/20260421164918_align_reminder_rule_schema/migration.sql` - Hand-edited migration with data conversion before column drops
- `packages/shared/src/schemas/report.ts` - reportId nullable in adminReminderRuleSchema and adminReminderExecutionSchema
- `apps/api/src/modules/reminders/reminders.prisma-repository.ts` - Removed fake UUID fallback in toRuleDomain and toExecutionDomain, removed unused variable
- `apps/api/src/modules/admin/admin.prisma-repository.ts` - Removed fake UUID fallback in getSnapshot reminderRules/executions mapping
- `apps/api/src/modules/admin/admin.integration.test.ts` - Updated ReminderRule creation to use new fields
- `apps/api/src/modules/reminders/reminders.integration.test.ts` - Updated ReminderRule creation to use new fields

## Decisions Made

- Hand-edited migration SQL follows ADD -> UPDATE -> DROP sequence to prevent data loss (addresses v4-P3 critical pitfall)
- Made adminReminderExecutionSchema.reportId nullable alongside adminReminderRuleSchema to prevent Zod parse failures when execution's rule has no report

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] adminReminderExecutionSchema.reportId not nullable**

- **Found during:** Task 2 (Zod schema fix)
- **Issue:** Plan only specified making adminReminderRuleSchema.reportId nullable, but adminReminderExecutionSchema also has a required reportId that receives null from repository mappings
- **Fix:** Made adminReminderExecutionSchema.reportId also z.string().uuid().nullable()
- **Files modified:** packages/shared/src/schemas/report.ts
- **Verification:** Typecheck passes, no Zod parse errors for null reportId
- **Committed in:** 79ad44b (Task 2 commit)

**2. [Rule 3 - Blocking] reminders.integration.test.ts uses old ReminderRule columns**

- **Found during:** Task 2 (typecheck verification)
- **Issue:** Test file creates ReminderRule with old columns (name, cronExpression, enabled) which no longer exist after migration
- **Fix:** Updated to use new columns (kind, fireAt, timezone, status, version)
- **Files modified:** apps/api/src/modules/reminders/reminders.integration.test.ts
- **Verification:** Typecheck passes for this file
- **Committed in:** 79ad44b (Task 2 commit)

**3. [Rule 1 - Bug] Unused variable in extractRecipientEmail**

- **Found during:** Task 2 (typecheck verification)
- **Issue:** `const parts = dedupeKey.split(':')` declared but never used (TS6133)
- **Fix:** Removed the unused variable, actual extraction uses regex
- **Files modified:** apps/api/src/modules/reminders/reminders.prisma-repository.ts
- **Verification:** Typecheck error eliminated
- **Committed in:** 79ad44b (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 missing critical, 1 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- Prisma generate prompted for additional migration name after applying (interactive prompt); verified with `prisma migrate status` that schema is up to date
- Seed command via `prisma db seed` failed (tsx not found via npx); ran directly with `node --experimental-strip-types` instead

## Known Stubs

None - all data paths are wired and functional.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ReminderRule schema aligned between Prisma and Zod
- Repository mappings pass clean null values
- Ready for remaining backend hardening tasks (plans 02-04)

---

_Phase: 16-backend-hardening_
_Completed: 2026-04-21_

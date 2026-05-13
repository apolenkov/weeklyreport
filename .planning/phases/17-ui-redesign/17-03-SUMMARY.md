---
phase: 17-ui-redesign
plan: "03"
subsystem: api
tags: [api, trpc, admin, lead-form, testing]
dependency_graph:
  requires: [17-02]
  provides:
    [
      leadForm.requestReopen,
      admin.getSettings,
      admin.updateSettings,
      admin.saveStageAssignment,
      admin.deleteStageAssignment,
      admin.listStageAssignments,
    ]
  affects: [trpc-router, admin-service, lead-form-service]
tech_stack:
  added: []
  patterns:
    [
      repository-interface-extension,
      upsert-on-unique-constraint,
      spy-repository-testing,
    ]
key_files:
  created:
    - apps/api/src/modules/period/period.service.test.ts
    - apps/api/src/modules/weekly-report/weekly-report.service.test.ts
  modified:
    - apps/api/src/modules/report-sections/lead-form.service.ts
    - apps/api/src/modules/report-sections/lead-form.prisma-repository.ts
    - apps/api/src/modules/report-sections/lead-form.contract.test.ts
    - apps/api/src/modules/admin/admin.service.ts
    - apps/api/src/modules/admin/admin.prisma-repository.ts
    - apps/api/src/modules/admin/admin.service.test.ts
    - apps/api/src/infrastructure/trpc/trpc.router.ts
decisions:
  - "requestReopen uses console.log instead of DB table (no ReopenRequest model in schema)"
  - "Stage assignment uses Prisma upsert on unique(userId,stageId,projectId) for idempotency"
  - "AppSettings uses upsert with singleton ID for lazy initialization"
metrics:
  duration: "8min"
  completed: "2026-04-24"
  tasks_completed: 4
  tasks_total: 4
  tests_added: 20
  tests_total: 382
---

# Phase 17 Plan 03: Remaining API Gaps Summary

Close 3 missing API endpoints (requestReopen, admin settings CRUD, stage assignment CRUD) and add service-level unit tests for period and weekly-report modules.

## Tasks Completed

| Task | Name                                     | Commit  | Key Changes                                                |
| ---- | ---------------------------------------- | ------- | ---------------------------------------------------------- |
| 1    | API-04: leadForm.requestReopen           | a3cc4a5 | Service method + repo interface + tRPC procedure + 2 tests |
| 2    | API-11: admin.getSettings/updateSettings | 4f7937d | Settings CRUD on AppSettings singleton + 3 tests           |
| 3    | API-12: Stage Assignment CRUD            | 4beb32b | save/delete/list + Prisma upsert + 3 tests                 |
| 4    | Service tests for period + weekly-report | 318f6f1 | 9 period tests + 5 weekly-report tests                     |

## Implementation Details

### API-04: leadForm.requestReopen

- Extended `LeadFormRepository` interface with `createReopenRequest(sectionId, userId, reason?)`
- Service validates: section exists, caller is author, section is submitted
- Repository implementation: console.log (no `ReopenRequest` model in Prisma schema)
- tRPC: `leadForm.requestReopen` (protectedProcedure, mutation)

### API-11: admin.getSettings / admin.updateSettings

- Extended `AdminRepository` with `getSettings()` and `updateSettings(data)`
- Prisma: upsert on `AppSettings` singleton (id='singleton') for lazy init
- All output parsed through `appSettingsSchema` / `appSettingsUpdateSchema`
- tRPC: `admin.getSettings` (query) + `admin.updateSettings` (mutation), both headProcedure

### API-12: Stage Assignment CRUD

- Extended `AdminRepository` with `saveStageAssignment`, `deleteStageAssignment`, `listStageAssignments`
- Prisma: upsert on unique constraint `(userId, stageId, projectId)` for idempotency
- Read model joins stage.name and user.name for `StageAssignment` schema compliance
- tRPC: 3 procedures under admin namespace, all headProcedure

### Service Tests

- **period.service.test.ts** (9 tests): spy-based repo verification, publish-reopen-publish cycle, error type discrimination (Error vs PeriodAccessError), cross-report independence
- **weekly-report.service.test.ts** (5 tests): spy-based repo call verification, fallback to active report, domain error types, published data passthrough

## Verification

- `pnpm --filter @customreport/api test -- --run`: 28 files, 382 tests, 0 failures
- `pnpm typecheck`: No errors found

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

**1. requestReopen repository implementation** (lead-form.prisma-repository.ts, line ~283)

- Logs to console instead of creating a DB record
- Intentional: plan says "just create a simple record/log" and no ReopenRequest model exists in Prisma schema
- Future plan will add a Notification model or reopen-request workflow

## Self-Check: PASSED

All 9 key files verified present. All 4 task commits verified in git log.

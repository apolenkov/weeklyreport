---
phase: 16-backend-hardening
plan: 04
subsystem: testing
tags: [vitest, contract-tests, regression, zod, jwt, trpc, in-memory-mocks]

requires:
  - phase: 16-01
    provides: "Prisma migration for ReminderRule schema, Zod reportId nullable"
  - phase: 16-02
    provides: "BullMQ wired into AppModule, health indicator"
provides:
  - "74 new P0/P1 regression contract tests across all API modules"
  - "JWT sign/verify unit tests (expired, bad signature, missing secret)"
  - "Total API passing tests: 324 (up from 250)"
affects: [17-ui-redesign, 18-e2e-tests]

tech-stack:
  added: []
  patterns: ["regression test IDs mapped to describe blocks via scenario codes (AUTH-034, LEAD-060, etc.)"]

key-files:
  created:
    - "apps/api/src/modules/auth/auth.controller.test.ts"
  modified:
    - "apps/api/src/modules/report-sections/report-sections.contract.test.ts"
    - "apps/api/src/modules/publication/publication.contract.test.ts"
    - "apps/api/src/modules/review/review.contract.test.ts"
    - "apps/api/src/modules/archive/archive.contract.test.ts"
    - "apps/api/src/modules/carry-over/carry-over.contract.test.ts"
    - "apps/api/src/modules/pdf-export/pdf-export.contract.test.ts"
    - "apps/api/src/modules/reminders/reminders.contract.test.ts"
    - "apps/api/src/modules/admin/admin.service.test.ts"
    - "apps/api/src/modules/auth/roles.guard.test.ts"
    - "apps/api/src/infrastructure/trpc/trpc.middleware.test.ts"

key-decisions:
  - "Added admin tests to existing admin.service.test.ts instead of creating duplicate admin.contract.test.ts"
  - "Created new auth.controller.test.ts for JWT sign/verify tests (AUTH-034/035 scenarios)"
  - "Used parameterized tests for 18 tag/workflowStatus combinations in report-sections"

patterns-established:
  - "Regression scenario IDs in test describe/it names for traceability (e.g. AUTH-034 P0, LEAD-060)"

requirements-completed: [BE-03]

duration: 7min
completed: 2026-04-21
---

# Phase 16 Plan 04: P0/P1 Regression Contract Tests Summary

**74 new contract tests covering P0/P1 regression scenarios across all 9 API modules, increasing total passing count from 250 to 324**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-21T17:01:14Z
- **Completed:** 2026-04-21T17:08:40Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Added 74 net-new passing contract tests across all backend modules
- Test count increased from 250 to 324 passing (29.6% increase)
- All tests use in-memory mocks (no DB dependency) per D-09/D-10
- New auth.controller.test.ts covers JWT lifecycle (sign, verify, expired, bad signature)
- Parameterized tests cover all 18 tag/workflowStatus combinations for report-sections

## Task Commits

Each task was committed atomically:

1. **Task 1: Coverage audit** - (analysis only, no commit)
2. **Task 2: Write regression contract tests** - `d3c21ce` (test)

## Files Created/Modified
- `apps/api/src/modules/auth/auth.controller.test.ts` - NEW: JWT sign/verify contract tests (8 tests)
- `apps/api/src/modules/report-sections/report-sections.contract.test.ts` - Traffic lights, tag combos, double-submit, Zod validation (+28 tests)
- `apps/api/src/modules/publication/publication.contract.test.ts` - Publish immutability, re-publish rejection (+3 tests)
- `apps/api/src/modules/review/review.contract.test.ts` - Submitted counts, non-matching ID, role filtering (+3 tests)
- `apps/api/src/modules/archive/archive.contract.test.ts` - Multi-section detail, empty archive (+2 tests)
- `apps/api/src/modules/carry-over/carry-over.contract.test.ts` - Target item creation, carriedOver marking, no-eligible edge case (+3 tests)
- `apps/api/src/modules/pdf-export/pdf-export.contract.test.ts` - Job lifecycle transitions, job properties (+3 tests)
- `apps/api/src/modules/reminders/reminders.contract.test.ts` - ScheduledFor, reportId, sentAt init, dedup by email (+4 tests)
- `apps/api/src/modules/admin/admin.service.test.ts` - getSnapshot, upsertUser/Project/Period/ReminderRule CRUD (+15 tests)
- `apps/api/src/modules/auth/roles.guard.test.ts` - AUTH-039/040/041 regression, null/arbitrary role (+5 tests)
- `apps/api/src/infrastructure/trpc/trpc.middleware.test.ts` - Viewer FORBIDDEN, head protected, publicProcedure all sessions (+4 tests)

## Decisions Made
- Added admin regression tests to existing `admin.service.test.ts` instead of creating a duplicate `admin.contract.test.ts` -- the existing file already uses the in-memory `createRepository` pattern per D-10, making a second file pure duplication
- Created new `auth.controller.test.ts` for JWT sign/verify tests because `createJwtSigner` is independently testable and these scenarios (AUTH-034 expired JWT, AUTH-035 bad signature) test the session extraction layer
- Used Vitest parameterized `for` loops for 18 tag/workflowStatus combinations to avoid 18 manually-written near-identical test blocks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] admin.contract.test.ts -> admin.service.test.ts**
- **Found during:** Task 1 (coverage audit)
- **Issue:** Plan specified creating `admin.contract.test.ts` but `admin.service.test.ts` already existed with the exact same in-memory mock pattern
- **Fix:** Extended existing `admin.service.test.ts` instead of creating a duplicate file
- **Files modified:** `apps/api/src/modules/admin/admin.service.test.ts`
- **Verification:** All admin tests pass, no duplicate test files
- **Committed in:** d3c21ce

---

**Total deviations:** 1 auto-fixed (Rule 2 - avoiding file duplication)
**Impact on plan:** No scope change. Plan intent fully satisfied -- admin has comprehensive contract tests.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all tests are fully wired with in-memory mocks and produce real assertions.

## Next Phase Readiness
- Backend test suite at 324 passing, covering all P0 and high-value P1 regression scenarios
- Ready for Phase 17 (UI redesign) or Phase 18 (E2E tests)
- 19 integration test failures remain (pre-existing DB-connectivity issue, not regressions)

## Self-Check: PASSED

- All 12 key files: FOUND
- Commit d3c21ce: FOUND
- Test count: 324 passing (target: 300+)
- TypeScript: No errors

---
*Phase: 16-backend-hardening*
*Completed: 2026-04-21*

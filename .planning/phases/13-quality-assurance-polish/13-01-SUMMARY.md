---
phase: 13-quality-assurance-polish
plan: 01
subsystem: api
tags: [nestjs, prisma, tRPC, bugfix, carry-over, pdf-export, reminders, auth]

requires:
  - phase: 07-production-infrastructure
    provides: BullMQ queues, Docker Compose, NestJS API with tRPC endpoints
provides:
  - Published-report guard in saveDraft prevents data corruption after report publication
  - Carry-over processes ALL sections via findMany with idempotency guard
  - PDF export markExportFailed method + auth cookie builder for Playwright
  - Reminder dedupeKey includes recipientEmail for per-recipient uniqueness
  - Admin removeUser handles FK constraints gracefully
  - Logout uses dynamic AUTH_JWT_COOKIE_NAME env var
affects: [13-quality-assurance-polish, testing, pdf-export, carry-over]

tech-stack:
  added: []
  patterns:
    - "Repository interface getReportStatus for cross-entity status checks"
    - "findMany for bulk section processing in carry-over"
    - "dedupeKey parsing for recipientEmail extraction"

key-files:
  created: []
  modified:
    - apps/api/src/modules/report-sections/report-sections.service.ts
    - apps/api/src/modules/report-sections/report-sections.prisma-repository.ts
    - apps/api/src/modules/carry-over/carry-over.service.ts
    - apps/api/src/modules/carry-over/carry-over.prisma-repository.ts
    - apps/api/src/modules/pdf-export/pdf-export.service.ts
    - apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts
    - apps/api/src/modules/reminders/reminders.prisma-repository.ts
    - apps/api/src/modules/admin/admin.prisma-repository.ts
    - apps/api/src/modules/auth/auth.routes.ts
    - apps/web/src/components/head/assembled-report-review.tsx

key-decisions:
  - "Carry-over interface changed from single-section (getSourceSection/getTargetSection) to multi-section (getSourceSections/getTargetSections) to process all leads"
  - "dedupeKey recipientEmail extracted via regex parsing of stored key format rather than adding new DB column"
  - "buildAuthCookies method added to PdfExportService rather than inline in processor to keep PDF auth configuration testable"

patterns-established:
  - "Repository-level idempotency guard: check findFirst before create in transaction"
  - "DB field mapping: read actual DB column values instead of hardcoding domain defaults"

requirements-completed: [QA-01]

duration: 14min
completed: 2026-04-12
---

# Phase 13 Plan 01: API Bug Fixes Summary

**Fix 10 P0/P1 API-layer bugs: published-report guard, carry-over findMany, PDF auth cookies, reminder dedup, admin delete, logout env cookie**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-12T10:29:26Z
- **Completed:** 2026-04-12T10:43:19Z
- **Tasks:** 2
- **Files modified:** 14 (10 source + 4 test)

## Accomplishments

- Fixed 6 backend service bugs: saveDraft guards published reports, carry-over processes all sections idempotently, reminder kind reads from DB, admin deletes user from DB, logout uses env cookie name
- Fixed 4 remaining bugs: PDF export markExportFailed + auth cookie builder, reminder dedupeKey extracts recipientEmail, head item edit guards empty items array
- All 12 related unit tests pass (carry-over 4/4, report-sections 4/4, pdf-export 4/4)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix report-sections, carry-over, and auth bugs** - `0b9f614` (fix)
2. **Task 2: Fix PDF export and reminder bugs** - `d6a0dd6` (fix)

## Files Created/Modified

- `apps/api/src/modules/report-sections/report-sections.service.ts` - Added getReportStatus to repo interface, published-report guard in saveDraft
- `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts` - Implemented getReportStatus method
- `apps/api/src/modules/carry-over/carry-over.service.ts` - Changed to getSourceSections/getTargetSections (findMany), multi-section carry-over logic
- `apps/api/src/modules/carry-over/carry-over.prisma-repository.ts` - Changed findFirst to findMany, added idempotency guard in saveCarryOver
- `apps/api/src/modules/reminders/reminders.prisma-repository.ts` - Fixed toRuleDomain to read kind from rule.name, added extractRecipientEmail from dedupeKey
- `apps/api/src/modules/admin/admin.prisma-repository.ts` - Fixed hardcoded kind:'deadline' to rule.name, added P2003 FK error handling
- `apps/api/src/modules/auth/auth.routes.ts` - Logout uses AUTH_JWT_COOKIE_NAME env var
- `apps/api/src/modules/pdf-export/pdf-export.service.ts` - Added markExportFailed + buildAuthCookies methods
- `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts` - Added markExportFailed DB method
- `apps/web/src/components/head/assembled-report-review.tsx` - Added empty items guard in handleFirstItemChange

## Decisions Made

- Carry-over interface changed from single-section to multi-section approach to process all leads' sections for a report, not just the first one found
- recipientEmail is extracted from the dedupeKey string format rather than adding a new DB column
- PDF auth cookies are built via a service method (buildAuthCookies) rather than inline in the BullMQ processor for testability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed hardcoded kind:'deadline' in admin.prisma-repository.ts**

- **Found during:** Task 1 (BUG-007 fix)
- **Issue:** admin.prisma-repository.ts had the same hardcoded `kind: 'deadline'` as reminders.prisma-repository.ts
- **Fix:** Changed to `kind: rule.name` to read actual DB value
- **Files modified:** apps/api/src/modules/admin/admin.prisma-repository.ts
- **Committed in:** 0b9f614

**2. [Rule 3 - Blocking] Updated test repositories for new interface methods**

- **Found during:** Task 1 and Task 2
- **Issue:** Test mock repositories needed getReportStatus, getSourceSections/getTargetSections, and markExportFailed methods
- **Fix:** Added missing methods to test repositories in 3 test files
- **Files modified:** report-sections.service.test.ts, carry-over.service.test.ts, pdf-export.service.test.ts
- **Committed in:** 0b9f614, d6a0dd6

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered

- Worktree had no node_modules initially; ran pnpm install to resolve module resolution errors in tests
- Pre-existing TypeScript compilation errors (TS2307, TS7006) across the monorepo due to missing type declarations; these are not caused by this plan's changes

## Known Stubs

None -- all methods are fully implemented with real logic.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 10 API-layer bugs fixed and verified
- Ready for Plan 02 (schema/frontend bugs) and Plan 03+ (test coverage)

---

_Phase: 13-quality-assurance-polish_
_Completed: 2026-04-12_

---
phase: 17-ui-redesign
plan: 07
subsystem: ui, testing
tags: [next.js, print, pdf, vitest, zod, integration-tests]

requires:
  - phase: 17-ui-redesign (plans 03-06)
    provides: Dashboard, weekly report, lead form, admin panel UI + Wave 2 API services
provides:
  - Print/PDF template for A4-optimized report export
  - Published report viewer with navigation and Export PDF
  - 35 integration tests for Wave 2 API services
  - 48 schema validation tests for v4.0 types
affects: [phase-18-backend, pdf-export-pipeline]

tech-stack:
  added: []
  patterns:
    [
      inline-style print template for PDF rendering,
      service-level integration tests with mock repos,
    ]

key-files:
  created:
    - apps/web/src/app/(app)/reports/[reportId]/print/page.tsx
    - apps/api/src/modules/period/period.integration.test.ts
    - apps/api/src/modules/weekly-report/weekly-report.integration.test.ts
    - apps/api/src/modules/report-sections/fill-from.integration.test.ts
    - apps/api/src/modules/report-sections/version-history.integration.test.ts
    - apps/api/src/modules/admin/admin-settings.integration.test.ts
    - apps/api/src/modules/admin/stage-assignment.integration.test.ts
  modified:
    - apps/web/src/app/(app)/reports/[reportId]/page.tsx
    - packages/shared/src/schemas/__tests__/report.test.ts

key-decisions:
  - "Print template uses inline styles (not Tailwind) for reliable PDF rendering"
  - "Integration tests use mock repositories (same as service tests) not Prisma DB"

patterns-established:
  - "Print pages: server-only, white bg, inline styles, @media print CSS, max-w-210mm"
  - "Integration test naming: *.integration.test.ts with mock repos for service-level tests"

requirements-completed: [UI-20]

duration: 10min
completed: 2026-04-24
---

# Phase 17 Plan 07: Wave 6 — Print/PDF + Integration Tests Summary

**A4-optimized print template with Starbucks design tokens, published report viewer with Export PDF, and 35 integration tests covering period lifecycle, weekly report data shapes, fill-from, version history, admin settings, and stage assignments**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-24T18:19:00Z
- **Completed:** 2026-04-24T18:29:55Z
- **Tasks:** 4 (+ 1 fix commit)
- **Files modified:** 9

## Accomplishments

- Print/PDF template renders complete weekly report with portfolio table, per-product sections, KPIs, and CSS @media print rules for page breaks
- Published report viewer shows formatted report with Back to Dashboard link and green accent Export PDF button linking to print page
- 35 new integration tests across 6 files covering all Wave 2 API services (period, weekly-report, fill-from, version-history, admin-settings, stage-assignments)
- 48 new schema validation tests for v4.0 types (periodStatusSchema, stageSchema, stageAssignmentSchema, versionSnapshotSchema, appSettingsSchema, weeklyReportReadModelSchema, portfolioProductOverviewSchema, escalationSchema)
- All 382 existing API unit tests unaffected; 220 shared package tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Print/PDF Template** - `6ff5ae5` (feat)
2. **Task 2: Published Report Viewer** - `8075ba2` (feat)
3. **Task 3: Schema Validation Tests** - `d74b489` (test)
4. **Task 4: Integration Tests** - `171f872` (test)
5. **Fix: Remove unused imports** - `13a16d7` (fix)

## Files Created/Modified

- `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx` - A4 print template with inline styles, portfolio table, product sections
- `apps/web/src/app/(app)/reports/[reportId]/page.tsx` - Published report viewer with nav, Export PDF, KPI cards
- `packages/shared/src/schemas/__tests__/report.test.ts` - Extended with 48 new schema tests for v4.0 types
- `apps/api/src/modules/period/period.integration.test.ts` - 8 tests: publish/reopen lifecycle
- `apps/api/src/modules/weekly-report/weekly-report.integration.test.ts` - 6 tests: data shapes, escalations
- `apps/api/src/modules/report-sections/fill-from.integration.test.ts` - 5 tests: copy, snapshot ordering, auth
- `apps/api/src/modules/report-sections/version-history.integration.test.ts` - 7 tests: list, restore, auth
- `apps/api/src/modules/admin/admin-settings.integration.test.ts` - 5 tests: get/update settings, auth
- `apps/api/src/modules/admin/stage-assignment.integration.test.ts` - 4 tests: CRUD, idempotent

## Decisions Made

- **Print template uses inline styles instead of Tailwind CSS** -- Inline styles ensure reliable rendering in Playwright's PDF capture; Tailwind classes may not resolve correctly in headless browser context without full CSS extraction
- **Integration tests use mock repositories, not Prisma DB** -- Follows existing \*.service.test.ts pattern; these test service logic with controlled mock data, not database behavior
- **Skipped Step 5 (MSW handlers)** -- Not in success criteria and MSW infrastructure not set up yet for web tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused imports for strict TypeScript compliance**

- **Found during:** Verification (typecheck + web build)
- **Issue:** Unused imports (MOCK_LEADS, VersionSnapshot, WeeklyReportDomainError, leadSession, sectionId2, authorId2) caused strict TS errors
- **Fix:** Removed all unused imports from 5 files
- **Files modified:** print/page.tsx, page.tsx, period.integration.test.ts, fill-from.integration.test.ts, weekly-report.integration.test.ts
- **Verification:** `pnpm --filter @customreport/web build` succeeds, all tests pass
- **Committed in:** `13a16d7`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Trivial cleanup fix. No scope creep.

## Issues Encountered

- Pre-existing TypeScript strict-mode errors in `pdf-export.service.test.ts` (unused `error` variable) and `period.contract.test.ts` (unused `userId`) cause `pnpm typecheck` to fail. These are not regressions from this plan -- they existed before and are out of scope.

## Known Stubs

- Print and published report pages use mock data from `dashboard/mock-data.ts` instead of live tRPC calls. This is intentional -- real data wiring will happen when the backend API is connected in a future phase.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 17 is now complete (all 7 plans executed)
- Print template is ready for Playwright PDF capture pipeline
- Published report viewer is ready for live data wiring
- 35 + 48 = 83 new test cases provide safety net for upcoming backend work

## Self-Check: PASSED

All 10 files verified present. All 5 commit hashes verified in git log.

---

_Phase: 17-ui-redesign_
_Completed: 2026-04-24_

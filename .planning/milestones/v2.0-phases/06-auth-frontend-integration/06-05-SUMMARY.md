---
phase: 06-auth-frontend-integration
plan: 05
subsystem: testing
tags: [vitest, jsdom, msw, trpc, testing-library]

requires:
  - phase: 06-03
    provides: frontend pages migrated from localStorage to tRPC hooks
  - phase: 06-04
    provides: admin page migrated, all localStorage helper files deleted

provides:
  - Vitest configured with jsdom environment for all web tests
  - MSW server intercepting tRPC HTTP requests in tests
  - Test utility with TRPCProvider wrapper for component tests
  - All 9 frontend test suites passing (27 tests, 0 failures)
  - Test fixtures replacing deleted demo-section.ts

affects: [phase-07]

tech-stack:
  added: [msw@2.13.0]
  patterns:
    [
      MSW tRPC batch handler,
      test fixtures for deleted helpers,
      pnpm zod resolve alias,
    ]

key-files:
  created:
    - apps/web/vitest.config.ts
    - apps/web/vitest.setup.ts
    - apps/web/src/test/msw-handlers.ts
    - apps/web/src/test/test-utils.tsx
    - apps/web/src/test/fixtures.ts
  modified:
    - apps/web/package.json
    - apps/web/src/components/report-section/report-section-form.test.tsx
    - apps/web/src/components/report-section/report-submit.spec.tsx

key-decisions:
  - "MSW handlers use wildcard GET/POST matching with procedure name switch for tRPC batch format"
  - "Test fixtures extracted to src/test/fixtures.ts to replace deleted demo-section.ts without duplication"
  - "Vitest excludes e2e/ directory (Playwright tests run separately via playwright test)"
  - "Zod resolved via createRequire from packages/shared context for pnpm strict isolation"

patterns-established:
  - "MSW tRPC mocking: http.get/post on /trpc/* with batch-aware response format"
  - "Test render with providers: renderWithProviders() wraps components in TRPCProvider for hook tests"
  - "Vitest e2e exclusion: e2e/** excluded to prevent Playwright/Vitest test() collision"

requirements-completed: [QA-02, QA-03]

duration: 9min
completed: 2026-04-10
---

# Phase 6 Plan 5: Fix Frontend Tests Summary

**Vitest jsdom + MSW test infrastructure; all 9 test suites passing (27 tests) with tRPC mock handlers**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-10T21:39:50Z
- **Completed:** 2026-04-10T21:49:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- All 9 frontend test files pass with 27 tests and 0 failures (QA-02)
- Vitest configured with jsdom environment, MSW setup file, and e2e exclusion
- MSW handlers cover all tRPC procedures (reports, review, admin, archive, pdfExport)
- Test utility provides TRPCProvider wrapper for component tests needing tRPC hooks
- Zero imports from deleted localStorage files in any test or production file

## Task Commits

Each task was committed atomically:

1. **Task 1: Configure Vitest with jsdom, install MSW, create MSW handlers + test utilities** - `41697e7` (feat)
2. **Task 2: Fix all 9 frontend test files to work with tRPC + MSW** - `a11ecf7` (fix)

## Files Created/Modified

- `apps/web/vitest.config.ts` - Vitest config with jsdom, MSW setup, e2e exclusion, pnpm resolve aliases
- `apps/web/vitest.setup.ts` - MSW server lifecycle (beforeAll/afterEach/afterAll) + DOM cleanup
- `apps/web/src/test/msw-handlers.ts` - MSW handlers for all tRPC GET queries and POST mutations
- `apps/web/src/test/test-utils.tsx` - renderWithProviders() with TRPCProvider wrapper
- `apps/web/src/test/fixtures.ts` - createDemoSection() test fixture replacing deleted demo-section.ts
- `apps/web/package.json` - Added msw dev dependency, simplified test script
- `apps/web/src/components/report-section/report-section-form.test.tsx` - Updated import path
- `apps/web/src/components/report-section/report-submit.spec.tsx` - Updated import path

## Decisions Made

- Used `createRequire` from `packages/shared` context to resolve zod dynamically instead of hardcoding pnpm store path
- Created shared test fixtures file instead of inlining createDemoSection() in each test (avoids duplication)
- Excluded e2e/ directory from Vitest rather than trying to make Playwright tests compatible

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zod resolution failure in pnpm strict mode**

- **Found during:** Task 2 (running test suite)
- **Issue:** Vitest's `@customreport/shared` alias resolves to source files that import `zod`, but zod is not directly accessible from `apps/web` in pnpm's strict module resolution
- **Fix:** Added `zod` resolve alias in vitest.config.ts using `createRequire` from `packages/shared` context
- **Files modified:** apps/web/vitest.config.ts
- **Verification:** All tests pass including those importing from @customreport/shared schemas
- **Committed in:** a11ecf7 (Task 2 commit)

**2. [Rule 3 - Blocking] Playwright E2E specs collide with Vitest**

- **Found during:** Task 2 (running test suite)
- **Issue:** `e2e/*.spec.ts` files use Playwright's `test()` which throws when called inside Vitest. 7 E2E suites reported as failed.
- **Fix:** Added `exclude: ['e2e/**', 'node_modules/**']` to vitest.config.ts test section
- **Files modified:** apps/web/vitest.config.ts
- **Verification:** Vitest discovers only 9 component/unit test files, all pass
- **Committed in:** a11ecf7 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to make tests run. No scope creep.

## Issues Encountered

- TypeScript typecheck errors in page components (Date/string serialization from tRPC) are pre-existing from plans 06-03/06-04 — not introduced by this plan. These are tRPC JSON serialization issues where `z.coerce.date()` returns strings over the wire but TypeScript types expect Date objects.
- API typecheck errors (Prisma client not generated in worktree) are pre-existing from Phase 5.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All frontend tests pass, test infrastructure is ready for Phase 7
- Pre-existing typecheck issues (Date/string serialization in page components) should be addressed in a future plan
- MSW handlers are extensible for new tRPC procedures added in Phase 7

---

_Phase: 06-auth-frontend-integration_
_Completed: 2026-04-10_

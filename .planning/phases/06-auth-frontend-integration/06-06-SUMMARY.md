---
phase: 06-auth-frontend-integration
plan: 06
subsystem: api
tags: [superjson, trpc, date-serialization, msw, typescript]

requires:
  - phase: 06-auth-frontend-integration
    provides: tRPC router, MSW test handlers, page components with tRPC queries

provides:
  - superjson transformer on tRPC server and client for transparent Date serialization
  - MSW handlers emitting superjson wire format for test fidelity
  - Type-safe page components without assertion workarounds

affects: [07-production-infrastructure]

tech-stack:
  added: [superjson@2.2.6]
  patterns: [superjson.serialize() in MSW handlers, tRPC transformer config]

key-files:
  created: []
  modified:
    - apps/api/src/infrastructure/trpc/trpc.middleware.ts
    - apps/web/src/lib/trpc.ts
    - apps/web/src/test/msw-handlers.ts
    - apps/web/src/app/(app)/admin/page.tsx
    - apps/web/src/app/(app)/lead/report/page.tsx
    - apps/web/src/app/(app)/head/report/page.tsx
    - apps/web/src/app/(app)/head/dashboard/page.tsx
    - apps/web/src/app/(app)/reports/history/page.tsx

key-decisions:
  - "superjson installed in both apps/api and apps/web (not shared package) since each app imports it directly"
  - "Removed explicit return type annotations from handler functions to let TypeScript infer tRPC types"
  - "Added nullability guards (?? []) for dashboard/history query data instead of type assertions"

patterns-established:
  - "tRPC transformer pattern: both server initTRPC.create() and client httpBatchLink() must specify transformer: superjson"
  - "MSW superjson pattern: wrap all procedure results with superjson.serialize() and use Date objects in mock data"

requirements-completed: [QA-03]

duration: 6min
completed: 2026-04-10
---

# Phase 6 Plan 06: Gap Closure Summary

**superjson transformer on tRPC server/client fixing 17 Date/string serialization errors, with MSW test handlers updated to match wire format**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-10T22:09:15Z
- **Completed:** 2026-04-10T22:15:25Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added superjson as tRPC data transformer on both server and client, making Date serialization/deserialization transparent
- Updated all MSW test handlers to emit superjson wire format with Date objects instead of ISO strings
- Removed all type assertion workarounds (as AdminSnapshot, as AssembledReport) from 6 page components
- All 27 frontend tests pass across 9 test suites with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add superjson transformer to tRPC server and client** - `d959be5` (feat)
2. **Task 2: Fix MSW handlers for superjson wire format, remove type assertion workarounds** - `e411c55` (fix)

## Files Created/Modified

- `apps/api/package.json` - Added superjson dependency
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` - Added transformer: superjson to initTRPC.create()
- `apps/web/package.json` - Added superjson dependency
- `apps/web/src/lib/trpc.ts` - Added transformer: superjson to httpBatchLink()
- `apps/web/src/test/msw-handlers.ts` - Wrapped results with superjson.serialize(), converted date strings to Date objects
- `apps/web/src/app/(app)/admin/page.tsx` - Removed 7 'as AdminSnapshot' assertions, added nullability guard
- `apps/web/src/app/(app)/lead/report/page.tsx` - Removed explicit return type annotations
- `apps/web/src/app/(app)/head/report/page.tsx` - Removed 'as AssembledReport' assertion, removed unused import
- `apps/web/src/app/(app)/head/dashboard/page.tsx` - Added ?? [] for undefined query data
- `apps/web/src/app/(app)/reports/history/page.tsx` - Added ?? [] for undefined query data

## Decisions Made

- Installed superjson in both apps individually rather than shared package, since each app imports it directly at the tRPC initialization layer
- Removed explicit return type annotations from handler functions (handleSaveDraft, handleSubmit, handlePublish, etc.) to let TypeScript infer the correct tRPC-provided types with Date fields
- Used `?? []` fallback for dashboard/history query data rather than non-null assertion, providing safe undefined handling

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed undefined assignability in dashboard and history pages**
- **Found during:** Task 2 (type assertion removal)
- **Issue:** `dashboardQuery.data` and `archiveQuery.data` are `T[] | undefined` but component props expect `T[]` -- this was a pre-existing TS2322 error not in the original 17-error count
- **Fix:** Added `?? []` fallback: `rows={dashboardQuery.data ?? []}` and `reports={archiveQuery.data ?? []}`
- **Files modified:** apps/web/src/app/(app)/head/dashboard/page.tsx, apps/web/src/app/(app)/reports/history/page.tsx
- **Verification:** Web typecheck shows zero errors in app/ directory
- **Committed in:** e411c55 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor additional fix for completeness. No scope creep.

## Issues Encountered

- Pre-existing typecheck errors in apps/api (Prisma client not generated, implicit any types) and packages/shared (zod module not found) prevent full monorepo typecheck from passing clean. These are outside this plan's scope -- they existed before the superjson changes and are not caused by them. The specific page component errors (Date/string mismatches, type assertions) targeted by this plan are all resolved.

## Known Stubs

None -- all changes are fully wired with no placeholder data.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- tRPC data transformer pattern is established for the entire monorepo
- All page components use tRPC-inferred types without workarounds
- Frontend test infrastructure correctly mirrors superjson wire format
- Ready for Phase 7 (Production Infrastructure)

## Self-Check: PASSED

- All 8 modified files exist on disk
- Commit d959be5 (Task 1) found in git log
- Commit e411c55 (Task 2) found in git log
- 06-06-SUMMARY.md created successfully
- grep confirms superjson transformer in both trpc.middleware.ts and trpc.ts
- grep confirms zero 'as AdminSnapshot' or 'as unknown' assertions in app/
- 27/27 tests passing across 9 test suites

---
*Phase: 06-auth-frontend-integration*
*Completed: 2026-04-10*

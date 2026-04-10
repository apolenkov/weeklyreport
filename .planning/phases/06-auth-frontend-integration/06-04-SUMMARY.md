---
phase: 06-auth-frontend-integration
plan: 04
subsystem: ui
tags: [trpc, react, localStorage-removal, admin-panel]

requires:
  - phase: 06-02
    provides: tRPC client setup (trpc.ts, TRPCProvider)
provides:
  - Admin page migrated from localStorage to tRPC hooks
  - All 6 localStorage helper files deleted (admin-runtime, section-storage, report-runtime, dev-session, use-browser-state, demo-section)
  - Zero STORAGE_KEY constants remaining in codebase
affects: [06-05-test-fixes]

tech-stack:
  added: []
  patterns: [tRPC mutation with invalidate-then-fetch for optimistic UI updates]

key-files:
  created: []
  modified: [apps/web/src/app/(app)/admin/page.tsx]

key-decisions:
  - "Hardcode role='head' in AppShell since headProcedure enforces server-side auth"
  - "Use utils.admin.snapshot.fetch() after each mutation to return fresh AdminSnapshot to AdminPanel"
  - "CarryOver logic uses second-to-last and last periods from snapshot.periods"

patterns-established:
  - "tRPC admin pattern: mutation + invalidate + fetch for callback props returning fresh data"
  - "QueryError handles UNAUTHORIZED redirect and FORBIDDEN display automatically"

requirements-completed: [FE-07, FE-10]

duration: 4min
completed: 2026-04-10
---

# Phase 06 Plan 04: Admin tRPC Migration + localStorage File Deletion Summary

**Admin page rewired to 8 tRPC mutations/queries, all 6 localStorage helper files deleted -- zero localStorage code remains in production source files**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T21:30:07Z
- **Completed:** 2026-04-10T21:34:00Z
- **Tasks:** 2/2
- **Files modified:** 1 rewritten, 6 deleted

## Accomplishments

- Admin page migrated from 8 localStorage-backed callbacks to 8 tRPC hooks (snapshot query + 7 mutations)
- All 6 localStorage helper files deleted: admin-runtime.ts, section-storage.ts, report-runtime.ts, dev-session.ts, use-browser-state.ts, demo-section.ts
- Zero STORAGE_KEY constants and zero localStorage calls remain in non-test source files
- Loading and error states added via QueryError component with UNAUTHORIZED redirect support

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate admin page to tRPC hooks** - `bab6750` (feat)
2. **Task 2: Delete all localStorage helper files (D-08, D-09, D-10)** - `07f03cc` (feat)

## Files Created/Modified

- `apps/web/src/app/(app)/admin/page.tsx` - Rewritten: localStorage imports replaced with tRPC hooks for all 8 CRUD operations
- `apps/web/src/components/admin/admin-runtime.ts` - **Deleted** (190 lines, localStorage CRUD for admin snapshot)
- `apps/web/src/components/report-section/section-storage.ts` - **Deleted** (57 lines, localStorage for lead sections)
- `apps/web/src/components/report/report-runtime.ts` - **Deleted** (314 lines, localStorage for reports/PDF/archive)
- `apps/web/src/lib/dev-session.ts` - **Deleted** (117 lines, dev-only browser session)
- `apps/web/src/lib/use-browser-state.ts` - **Deleted** (29 lines, SSR-safe localStorage hook)
- `apps/web/src/components/report-section/demo-section.ts` - **Deleted** (38 lines, demo data factory)

## Decisions Made

- **Hardcoded role="head" in AppShell**: The admin page is only accessible to head users. Server-side `headProcedure` enforces this via JWT role check. If a non-head user accesses the page, the tRPC query returns FORBIDDEN and QueryError displays the appropriate message.
- **Fresh fetch after each mutation**: Each callback handler calls `utils.admin.snapshot.fetch()` after the mutation to return fresh `AdminSnapshot` data to `AdminPanel`, which updates its local state.
- **CarryOver uses period ordering**: Extracts source (second-to-last) and target (last) from `snapshot.periods` array, matching the original localStorage-based logic.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all tRPC procedures are wired to real backend service methods.

## Issues Encountered

- **Parallel execution note**: Pages migrated by Plan 06-03 (lead/report, head/report, head/dashboard, reports/[reportId], reports/history, submission-dashboard) still reference the deleted localStorage files in this worktree. This is expected because 06-03 runs in parallel and will update those pages to use tRPC. When both worktrees merge to main, all references will be resolved.
- **API typecheck errors**: Pre-existing type errors in `apps/api/` (missing tRPC server packages) are unrelated to this plan's changes. The admin page itself compiles cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Admin page is fully tRPC-backed, ready for integration testing
- Plan 06-05 (test fixes) can proceed to update test files that reference deleted modules
- All localStorage code removed from production source files

## Self-Check: PASSED

- admin/page.tsx exists with tRPC hooks
- All 6 localStorage files confirmed deleted
- Commit bab6750 (Task 1) found
- Commit 07f03cc (Task 2) found
- SUMMARY.md exists

---
*Phase: 06-auth-frontend-integration*
*Completed: 2026-04-10*

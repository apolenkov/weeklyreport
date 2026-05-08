---
phase: 06-auth-frontend-integration
plan: 03
subsystem: ui
tags: [trpc, react, next.js, tRPC-hooks, localStorage-migration, pdf-polling]

requires:
  - phase: 06-02
    provides: tRPC client setup (trpc.ts, TRPCProvider wired in layout)
  - phase: 06-01
    provides: auth routes, tRPC context with JWT extraction, QueryError component
  - phase: 05-04
    provides: tRPC router with all namespaces (reports, review, pdfExport, archive, admin)
provides:
  - 5 page components rewritten from localStorage to tRPC hooks
  - Root page updated to navigation landing
  - PDF export polling pattern with automatic stop on completion
affects: [06-04, 06-05]

tech-stack:
  added: []
  patterns:
    [
      tRPC useQuery/useMutation page pattern,
      PDF polling with refetchInterval callback,
      cache invalidation via trpc.useUtils(),
    ]

key-files:
  modified:
    - apps/web/src/app/(app)/lead/report/page.tsx
    - apps/web/src/app/(app)/head/dashboard/page.tsx
    - apps/web/src/app/(app)/head/report/page.tsx
    - apps/web/src/app/(app)/reports/[reportId]/page.tsx
    - apps/web/src/app/(app)/reports/history/page.tsx
    - apps/web/src/app/page.tsx

key-decisions:
  - "Derive activeReportId from section.reportId on lead page instead of dev-session"
  - "PDF polling uses refetchInterval callback to stop when status is completed or failed"
  - "Head report page uses trpc.reports.saveDraft for section edits during review then invalidates assembled report cache"
  - "Role check removed from pages since tRPC middleware (headProcedure) enforces authorization server-side"

patterns-established:
  - "tRPC page pattern: useQuery for data, useMutation for writes, QueryError on error, Loading... on pending"
  - "PDF polling: refetchInterval with callback that checks query.state.data?.status to stop polling"
  - "Cache invalidation: trpc.useUtils().namespace.method.invalidate() after mutations that affect other queries"

requirements-completed: [FE-02, FE-03, FE-04, FE-05, FE-06, FE-08, FE-09]

duration: 4min
completed: 2026-04-10
---

# Phase 06 Plan 03: Frontend Page Migration Summary

**Rewrote 5 page components from localStorage/useBrowserState to tRPC hooks with loading/error states and PDF export polling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-10T21:29:45Z
- **Completed:** 2026-04-10T21:33:43Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- All 5 user-facing pages (lead report, head dashboard, head report, published report, archive history) now fetch data from the NestJS API via tRPC hooks instead of localStorage
- PDF export uses server-side mutation with automatic polling that stops on completion or failure
- Every page has consistent loading (`<p>Loading...</p>`) and error (`<QueryError>`) states
- Server-side authorization enforced via tRPC middleware removes need for client-side role checks
- Root page updated from placeholder to navigation landing with links to all role-specific routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate lead report + head dashboard + head report pages to tRPC** - `da85542` (feat)
2. **Task 2: Migrate published report + archive + PDF export pages to tRPC** - `e76214a` (feat)

## Files Created/Modified

- `apps/web/src/app/(app)/lead/report/page.tsx` - Lead section form backed by trpc.reports namespace
- `apps/web/src/app/(app)/head/dashboard/page.tsx` - Head submission dashboard backed by trpc.review.dashboard
- `apps/web/src/app/(app)/head/report/page.tsx` - Assembled report review backed by trpc.review.assembledReport
- `apps/web/src/app/(app)/reports/[reportId]/page.tsx` - Published report backed by trpc.archive.detail with PDF polling
- `apps/web/src/app/(app)/reports/history/page.tsx` - Archive list backed by trpc.archive.list
- `apps/web/src/app/page.tsx` - Navigation landing page with links to all routes

## Decisions Made

- **Derived activeReportId from API data**: Lead page gets `section.reportId` from the query result instead of relying on dev-session. Head pages pass `null` (will be wired to session context in auth completion).
- **PDF polling with conditional refetchInterval**: Uses the callback form of `refetchInterval` that inspects `query.state.data?.status` to automatically stop polling when the job reaches `completed` or `failed` status.
- **Head report section editing via saveDraft + invalidation**: When the head edits a section during review, uses `trpc.reports.saveDraft.mutateAsync()` then invalidates and refetches the assembled report cache to reflect changes.
- **Removed client-side role guards**: Pages no longer check `session.role !== 'head'` because the tRPC middleware (`headProcedure`) returns FORBIDDEN which QueryError handles with an appropriate message.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All pages are wired to real tRPC queries/mutations. The `role` prop passed to AppShell is hardcoded per page (`'lead'`, `'head'`, `'viewer'`) rather than derived from a session context. This will be resolved when auth session context is completed in plan 06-04/05.

## Issues Encountered

- Pre-existing TypeScript errors in the web package (admin panel implicit `any` types, `next/navigation` module resolution in worktree) are unrelated to this plan's changes. All errors are present on the main branch.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 core pages are API-backed and ready for end-to-end testing
- Admin page migration remains (plan 06-04/05)
- Session-based role/activeReportId derivation to be wired in future plans
- The tRPC page pattern established here is the template for admin page migration

---

_Phase: 06-auth-frontend-integration_
_Completed: 2026-04-10_

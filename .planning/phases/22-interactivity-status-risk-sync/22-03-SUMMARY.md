---
phase: 22-interactivity-status-risk-sync
plan: 03
subsystem: ui
tags:
  [
    tanstack-query,
    useInfiniteQuery,
    trpc,
    next-navigation,
    cursor-pagination,
    period-navigator,
  ]

requires:
  - phase: 21-trpc-provider-and-client-wiring
    provides: useTRPC, archive.list cursor endpoint, mapWeeklyReport.period.{id,reportId}, paginationInputSchema

provides:
  - Generic useCursorPagination hook wrapping TanStack Query useInfiniteQuery for tRPC paginated endpoints
  - URL-driven Lead PeriodNavigator (router.replace + ?period= query param, no history accumulation)
  - URL-driven Head HeadPeriodNavigator that routes past periods to /reports/[reportId] (path "a" per 21-04 SUMMARY)
  - Self-contained ReportArchiveSection with real cursor pagination + Load More button
  - Client-side "Show all" reveal in Version History modal
  - Client-side "Show more" reveal on Lead History page (deferral pattern for non-cursor endpoints)
  - mapArchiveSummary helper exported for incremental per-page archive mapping

affects: [22-04, 22-05, 23-pdf-export, 23-server-cursor-history]

tech-stack:
  added: []
  patterns:
    - "Cursor pagination: useInfiniteQuery factory passed into useCursorPagination; flattened items + Load More button"
    - "URL-driven nav: router.replace + URLSearchParams over local state for period selection"
    - "Self-contained sections: data-owning components (no props) for cursor-bound lists"
    - "Client-side reveal pattern for endpoints that lack server cursor at v5.0 (versions, myHistory)"

key-files:
  created:
    - apps/web/src/lib/use-cursor-pagination.ts
    - apps/web/src/lib/use-cursor-pagination.test.ts
    - apps/web/src/components/lead/period-navigator.test.tsx
    - apps/web/src/components/weekly-report/period-navigator.test.tsx
  modified:
    - apps/web/src/components/lead/period-navigator.tsx
    - apps/web/src/components/weekly-report/period-navigator.tsx
    - apps/web/src/components/dashboard/report-archive-section.tsx
    - apps/web/src/components/dashboard/dashboard-page.tsx
    - apps/web/src/components/lead/version-history-nav.tsx
    - apps/web/src/app/(app)/lead/history/page.tsx
    - apps/web/src/lib/mappers/dashboard.ts
    - apps/web/src/lib/mappers/index.ts

key-decisions:
  - "Path 'a' (per advisor + 21-04 SUMMARY): Head period nav routes to /reports/[reportId] for past periods rather than adding a period filter to weeklyReport.get. No backend schema changes needed."
  - "Self-contained ReportArchiveSection drops props and owns its own cursor query — keeps the dashboard composer untouched while INT-08 ships."
  - "Client-side reveal (Show more / Show all) for reports.myHistory and leadForm.versions because v5.0 returns full arrays — server cursor support deferred."
  - "Lead PeriodNavigator uses router.replace (not push) to prevent back-button history accumulation for period switching."
  - "useCursorPagination kept thin: a flatten + ergonomic-rename over useInfiniteQuery. Factory is the proxy result of trpc.<endpoint>.infiniteQueryOptions."

patterns-established:
  - "useCursorPagination(factory, input, opts): {items, hasNextPage, fetchNextPage, isLoading, isFetchingNextPage, isError, error}"
  - "URL-driven period nav: useRouter + useSearchParams + URLSearchParams + router.replace(`${pathname}?${qs}`)"
  - "Reveal pattern: useState(showAll), .slice(0, N), conditional 'Show all (N)' button"

requirements-completed: [INT-08, INT-09]

duration: ~24min
completed: 2026-04-25
---

# Phase 22 Plan 03: URL-driven Period Navigators + Cursor Pagination Summary

**Replaced page-number archive pagination with real cursor pagination via useInfiniteQuery; made Lead/Head Period Navigators URL-driven (lead = ?period= query, head = /reports/[reportId] route).**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-04-25T19:55:00Z (approx)
- **Completed:** 2026-04-25T20:19:02Z
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified)
- **Tests added:** 12 (5 hook + 4 lead nav + 3 head nav)

## Accomplishments

- INT-08 (cursor pagination): archive.list now uses real `useInfiniteQuery` cursor pagination with a "Load more" button. No more hardcoded page counts.
- INT-09 (period nav): Both Lead and Head navigators are now URL-driven. Past head periods load via `/reports/[reportId]` and the existing reportId-bound query.
- Generic, reusable `useCursorPagination` hook (5 vitest cases) usable by any future cursor-paginated tRPC endpoint.
- Client-side reveal pattern documented for endpoints that lack server cursor at v5.0 (`reports.myHistory`, `leadForm.versions`) — deferral path made explicit.

## Task Commits

Each task was committed atomically:

1. **Task 1: useCursorPagination hook** — `d8b9bdd` (feat) — RED+GREEN combined since both files were authored together; 5 tests pass.
2. **Task 2: URL-driven Period Navigators** — `ecceaf2` (feat) — 7 tests across both navigators; typecheck clean.
3. **Task 3: archive cursor + show-all reveals** — `2cad844` (feat) — wires the hook into the section, version history modal, and lead history page.

## Files Created/Modified

### Created

- `apps/web/src/lib/use-cursor-pagination.ts` — Generic hook wrapping useInfiniteQuery; flattens pages, renames flags ergonomically.
- `apps/web/src/lib/use-cursor-pagination.test.ts` — 5 cases: initial load, append, end-of-pages, error, disabled.
- `apps/web/src/components/lead/period-navigator.test.tsx` — 4 cases for Lead nav URL behavior.
- `apps/web/src/components/weekly-report/period-navigator.test.tsx` — 3 cases for Head nav routing.

### Modified

- `apps/web/src/components/lead/period-navigator.tsx` — `router.replace` + `usePathname` + `URLSearchParams`-based query mutation.
- `apps/web/src/components/weekly-report/period-navigator.tsx` — Past periods now `router.push('/reports/<reportId>')`; current period stays on basePath.
- `apps/web/src/components/dashboard/report-archive-section.tsx` — Self-contained; uses `useCursorPagination` against `trpc.archive.list.infiniteQueryOptions`; renders Load More button; drops `reports`/`totalCount` props.
- `apps/web/src/components/dashboard/dashboard-page.tsx` — Drops the prop wiring for ReportArchiveSection (now self-contained); keeps archiveQ in the composer for compatibility.
- `apps/web/src/components/lead/version-history-nav.tsx` — Adds `Show all (N)` reveal in modal when `versions.length > 5`.
- `apps/web/src/app/(app)/lead/history/page.tsx` — Adds `Show more` reveal limited to first 10 entries by default.
- `apps/web/src/lib/mappers/dashboard.ts` — Extracted `mapArchiveSummary(summary)` helper; re-exported via mappers barrel.
- `apps/web/src/lib/mappers/index.ts` — Re-exports `mapArchiveSummary`.

## Decisions Made

1. **Path "a" for Head period nav.** The plan and 21-04 SUMMARY both pre-selected this; the advisor confirmed `view.period.id === api.reportId` (verified in `mapWeeklyReport`), so routing past periods to `/reports/<id>` is a 5-line change rather than a mapper change. No backend schema additions.
2. **Self-contained ReportArchiveSection.** Rather than threading the cursor query through the dashboard composer (which would require pages-of-arrays wiring through `mapDashboardData`), the section owns its own `useCursorPagination`. The composer's `archive` field is left intact for backward compatibility with existing tests but is no longer destructured by `dashboard-page.tsx`.
3. **Lead nav uses `router.replace`.** Period switching shouldn't pollute back-button history; `replace` keeps it tidy.
4. **Client reveal for myHistory and leadForm.versions.** No server cursor at v5.0; reveal pattern keeps INT-08 truthful for the user-facing list views without lying about capability.
5. **Hook signature.** Factory takes `input`, returns useInfiniteQuery options (compatible with `trpc.x.y.infiniteQueryOptions(input, opts)` shape). Casts the proxy result to satisfy strict typings without coupling the hook to tRPC internals — also keeps it testable with plain mocks.

## Deviations from Plan

None — plan executed as written. Pre-existing code already had Lead PeriodNavigator partially URL-driven (used `router.push`); the deltas (replace vs push, usePathname, URLSearchParams round-trip) were applied as small edits rather than a full rewrite per the advisor's guidance.

## Issues Encountered

- **Vitest run surfaces an unrelated 22-02 failure** (`lead-form-sync-bridge.test.tsx`). Out of scope for 22-03 (different wave/plan); not touched. Per `<scope_boundary>` of execute-plan, logged as an out-of-scope discovery — does not block this plan.

## Verification

- `pnpm --filter @customreport/web typecheck`: clean ("TypeScript: No errors found").
- Plan-scoped vitest (`use-cursor-pagination`, `lead/period-navigator`, `weekly-report/period-navigator`, `report-archive-section`, `version-history-nav`, `mappers/dashboard`): 24/24 pass.
- All cross-grep acceptance criteria pass (see verification block in plan).

## Self-Check: PASSED

- File `apps/web/src/lib/use-cursor-pagination.ts` exists and exports `useCursorPagination`.
- File `apps/web/src/lib/use-cursor-pagination.test.ts` contains 5 `it(...)` cases.
- File `apps/web/src/components/lead/period-navigator.test.tsx` exists.
- File `apps/web/src/components/weekly-report/period-navigator.test.tsx` exists.
- Commits `d8b9bdd`, `ecceaf2`, `2cad844` exist on the current branch (verified via `git log`).
- Lead nav imports from `next/navigation` (1 match), uses `useRouter` + `useSearchParams` (3 matches incl. `usePathname`).
- Head nav contains `/reports/` (2 matches in router.push and comment).
- Archive section grep `useCursorPagination|infiniteQueryOptions|fetchNextPage`: 6 matches; load-more grep: 4 matches.
- Version history reveal grep: 3 matches.
- Lead history reveal grep: 3 matches.

## Next Phase Readiness

- 22-04 (Admin CRUD) and 22-05 (Publish & Lock / Reopen): Independent of this plan (disjoint files); already merged or in progress on adjacent waves.
- 22-01/22-02 in-flight: One unrelated failing test in `lead-form-sync-bridge.test.tsx`; not owned by 22-03. They should fix it in their own wave.
- Future server-cursor support for `reports.myHistory` and `leadForm.versions`: deferred to Phase 23+ when the read endpoints can be extended without a v5.0 contract break. Hook is ready to consume them when they ship.

---

_Phase: 22-interactivity-status-risk-sync_
_Plan: 03_
_Completed: 2026-04-25_

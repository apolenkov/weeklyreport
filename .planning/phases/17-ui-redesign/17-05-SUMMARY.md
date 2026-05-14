---
phase: 17-ui-redesign
plan: 05
subsystem: ui
tags:
  [
    react,
    tailwind,
    dashboard,
    weekly-report,
    accordion,
    kpi,
    pagination,
    starbucks-design,
  ]

requires:
  - phase: 17-ui-redesign/03
    provides: lead form components, period navigator pattern, mock data pattern
  - phase: 17-ui-redesign/04
    provides: lead history list, common component patterns

provides:
  - Dashboard page with KPI cards, alert bar, blocked/at-risk table, lead reports grid, archive
  - Weekly Report page with portfolio overview, per-product accordions, publish & lock flow
  - Comprehensive mock data for 6 leads, 12 products, 7 detailed product reports
  - Toggle All button that actually toggles accordion state

affects: [17-ui-redesign/06, 17-ui-redesign/07, api-integration, pdf-export]

tech-stack:
  added: []
  patterns:
    [
      per-product accordion grouping,
      conic-gradient KPI ring,
      numbered pagination,
      publish confirmation dialog with pending warning,
    ]

key-files:
  created:
    - apps/web/src/components/dashboard/mock-data.ts
    - apps/web/src/components/dashboard/dashboard-page.tsx
    - apps/web/src/components/dashboard/kpi-cards.tsx
    - apps/web/src/components/dashboard/alert-bar.tsx
    - apps/web/src/components/dashboard/blocked-at-risk-table.tsx
    - apps/web/src/components/dashboard/lead-report-card.tsx
    - apps/web/src/components/dashboard/lead-reports-grid.tsx
    - apps/web/src/components/dashboard/report-archive-section.tsx
    - apps/web/src/components/dashboard/toggle-all-button.tsx
    - apps/web/src/components/weekly-report/period-navigator.tsx
    - apps/web/src/components/weekly-report/portfolio-overview-table.tsx
    - apps/web/src/components/weekly-report/product-accordion.tsx
    - apps/web/src/components/weekly-report/publish-lock-button.tsx
    - apps/web/src/components/weekly-report/export-pdf-button.tsx
    - apps/web/src/components/weekly-report/weekly-report-page.tsx
  modified:
    - apps/web/src/app/(app)/head/dashboard/page.tsx
    - apps/web/src/app/(app)/head/report/page.tsx

key-decisions:
  - "Per-product accordion grouping (matching mockup S3) instead of per-lead accordions (plan text)"
  - "Portfolio overview as clickable product card grid (matching mockup) instead of table (plan text)"
  - "Numbered pagination for report archive (matching mockup) instead of Load More (plan text)"
  - "DOM-based toggle all using aria-expanded queries for cross-component state"

patterns-established:
  - "Product accordion: per-product grouping with needs-attention, current/next week, risks, decisions, priorities sections"
  - "KPI conic-gradient ring: circular progress indicator for submission counts"
  - "Traffic light dots: 18px circles with status icons for lead report cards"
  - "Publish confirmation dialog: warns about pending leads before locking"

requirements-completed: [UI-05, UI-06, UI-07, UI-08, UI-09, UI-10]

duration: 12min
completed: 2026-04-24
---

# Phase 17 Plan 05: Dashboard + Weekly Report Summary

**Head role Dashboard with KPI cards, lead reports grid, blocked/at-risk table, and report archive; Weekly Report with portfolio overview grid, per-product accordions, publish & lock flow, and export PDF**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-24T17:40:53Z
- **Completed:** 2026-04-24T17:53:00Z
- **Tasks:** 4
- **Files modified:** 17

## Accomplishments

- Dashboard page with 5 sections matching mockup S2: KPI cards (conic-gradient submission ring, deadline countdown, risk counts), pending alert bar, blocked/at-risk collapsible table, lead reports grid with traffic light dots and lock icons, report archive with numbered pagination
- Weekly Report page matching mockup S3: portfolio overview as clickable product card grid, 7 per-product accordion sections with items/risks/decisions/priorities, period navigator, publish & lock with confirmation dialog warning about pending leads, export PDF button with loading state
- Comprehensive mock data (493 lines): types and data for 6 leads, 12 portfolio products, 7 detailed product reports with Russian-language items
- Toggle All button that works via DOM aria-expanded queries

## Task Commits

Each task was committed atomically:

1. **Task 1: Mock data** - `762f780` (feat)
2. **Task 2: Dashboard components** - `e32ea28` (feat)
3. **Task 3: Weekly Report components** - `12605aa` (feat)
4. **Task 4: Build fix** - `9c7f1d3` (fix)

## Files Created/Modified

### Created (15 files)

- `apps/web/src/components/dashboard/mock-data.ts` - Types and mock data for both pages
- `apps/web/src/components/dashboard/dashboard-page.tsx` - Dashboard layout orchestrator
- `apps/web/src/components/dashboard/kpi-cards.tsx` - Submissions ring, deadline, risk counts
- `apps/web/src/components/dashboard/alert-bar.tsx` - Yellow pending leads banner with Send Reminder
- `apps/web/src/components/dashboard/blocked-at-risk-table.tsx` - Collapsible severity-tagged list
- `apps/web/src/components/dashboard/lead-report-card.tsx` - Single lead card with traffic lights
- `apps/web/src/components/dashboard/lead-reports-grid.tsx` - 6-lead collapsible grid
- `apps/web/src/components/dashboard/report-archive-section.tsx` - Paginated archive cards
- `apps/web/src/components/dashboard/toggle-all-button.tsx` - Collapse/expand all sections
- `apps/web/src/components/weekly-report/period-navigator.tsx` - Head-specific period nav
- `apps/web/src/components/weekly-report/portfolio-overview-table.tsx` - Clickable product card grid
- `apps/web/src/components/weekly-report/product-accordion.tsx` - Per-product expandable section
- `apps/web/src/components/weekly-report/publish-lock-button.tsx` - Publish with confirmation dialog
- `apps/web/src/components/weekly-report/export-pdf-button.tsx` - PDF export with loading state
- `apps/web/src/components/weekly-report/weekly-report-page.tsx` - Weekly report orchestrator

### Modified (2 files)

- `apps/web/src/app/(app)/head/dashboard/page.tsx` - Replaced placeholder with DashboardPage
- `apps/web/src/app/(app)/head/report/page.tsx` - Replaced placeholder with WeeklyReportPage

## Decisions Made

1. **Per-product accordion grouping** - Mockup S3 shows products (CRM Platform, Data Analytics, etc.) as the top-level grouping with contributing leads as badges, not per-lead accordions as the plan text suggested. Followed mockup over plan text.
2. **Portfolio overview as card grid** - Mockup shows a 2-column grid of clickable product summary cards, not a table. Implemented as grid with click-to-scroll-to-accordion behavior.
3. **Numbered pagination** - Mockup shows page numbers (1, 2, 3) with chevrons, not a "Load More" button. Implemented numbered pagination.
4. **DOM-based Toggle All** - Used document.querySelectorAll('[aria-expanded]') to toggle all accordions on the page, making it work across independently-stateful components.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused parameter causing strict build failure**

- **Found during:** Task 4 (verification)
- **Issue:** `period` parameter in WeeklyReportPage was declared but unused, causing Next.js strict build to fail
- **Fix:** Prefixed with underscore (`_period`) to indicate intentional non-use until tRPC integration
- **Files modified:** apps/web/src/components/weekly-report/weekly-report-page.tsx
- **Verification:** `pnpm --filter @customreport/web build` passes clean
- **Committed in:** 9c7f1d3

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Minimal - standard TypeScript strict mode compliance fix.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard and Weekly Report pages are fully functional with mock data
- Ready for Wave 5 (admin panel, login page, UI states) or API integration
- Product accordion pattern established for reuse in published report views
- Mock data structure ready to be replaced with tRPC calls

## Self-Check: PASSED

- All 17 files verified present on disk
- All 4 commit hashes verified in git log (762f780, e32ea28, 12605aa, 9c7f1d3)
- `pnpm typecheck` passes (no errors)
- `pnpm --filter @customreport/web build` passes (all routes generated)

---

_Phase: 17-ui-redesign_
_Completed: 2026-04-24_

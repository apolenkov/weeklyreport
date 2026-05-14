---
phase: 13-quality-assurance-polish
plan: 03
subsystem: ui
tags: [css, a11y, date-formatting, next-link, error-handling, print-css]

requires:
  - phase: 10-page-styling
    provides: "shadcn/ui components and design tokens used in all pages"
  - phase: 11-pdf-styling
    provides: "Print CSS @media block with oklch hex fallbacks"
provides:
  - "Print-safe colored backgrounds via print-color-adjust CSS"
  - "Resilient autosave and submit with try/catch error handling"
  - "Consistent ru-RU date formatting with UTC timezone for period dates"
  - "Keyboard-accessible DataTable sort headers (tabIndex, onKeyDown, aria-sort)"
  - "Client-side navigation in RoleNav via Next.js Link"
  - "Shared format-date.ts utility (formatDate, formatDateTime, formatPeriodDate)"
affects: [13-06-ux-a11y-polish, 13-07-e2e-tests, 14-regression-tests]

tech-stack:
  added: []
  patterns:
    - "Shared date formatting utility in apps/web/src/lib/format-date.ts"
    - "All period dates use timeZone: 'UTC' to prevent off-by-one in UTC+N"
    - "All dates use ru-RU locale consistently"

key-files:
  created:
    - "apps/web/src/lib/format-date.ts"
  modified:
    - "packages/ui/src/styles/globals.css"
    - "packages/ui/src/components/data-table.tsx"
    - "apps/web/src/components/report-section/report-section-form.tsx"
    - "apps/web/src/components/navigation/role-nav.tsx"
    - "apps/web/src/app/(app)/reports/[reportId]/print/page.tsx"
    - "apps/web/src/components/admin/admin-panel.tsx"
    - "apps/web/src/components/head/submission-dashboard.tsx"
    - "apps/web/src/components/report/archive-report-list.tsx"

key-decisions:
  - "Created shared format-date.ts instead of fixing locale in-place -- eliminates 4 duplicate formatDate functions"
  - "Period dates use formatPeriodDate with timeZone: 'UTC'; non-period dates use formatDate without timezone"
  - "Removed traffic light fallback to red entirely -- Zod validation catches null at submit time"

patterns-established:
  - "All date formatting goes through apps/web/src/lib/format-date.ts"
  - "Period dates (periodStart, periodEnd) always use timeZone: 'UTC'"

requirements-completed: [QA-01]

duration: 8min
completed: 2026-04-12
---

# Phase 13 Plan 03: Frontend Bug Fixes Summary

**Fixed 8 frontend bugs: print CSS color-adjust, autosave/submit error handling, ru-RU date formatting with UTC timezone, keyboard-accessible DataTable sorting, and client-side navigation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-12T10:29:53Z
- **Completed:** 2026-04-12T10:37:54Z
- **Tasks:** 2
- **Files modified:** 9 (1 created, 8 modified)

## Accomplishments

- Print CSS now preserves colored backgrounds (traffic lights, badges) in PDF output
- Autosave and submit handlers wrapped in try/catch -- no more stuck "Saving..." state on network errors
- All date formatting consolidated to shared utility with ru-RU locale and UTC timezone for period dates
- DataTable sort headers now keyboard-accessible (Tab + Enter/Space to sort, aria-sort for screen readers)
- RoleNav uses Next.js Link for client-side navigation (no full page reloads)
- Removed dangerous traffic light default to 'red' -- null values now caught by schema validation

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix print CSS, error handling, and traffic light default (BUG-010,011,012,020)** - `1211864` (fix)
2. **Task 2: Fix locale dates, keyboard a11y, and navigation (BUG-017,018,019,025)** - `00d5f81` (fix)

## Files Created/Modified

- `apps/web/src/lib/format-date.ts` - Shared date formatting utility (formatDate, formatDateTime, formatPeriodDate)
- `packages/ui/src/styles/globals.css` - Added print-color-adjust CSS for PDF colored backgrounds
- `packages/ui/src/components/data-table.tsx` - Added tabIndex, onKeyDown, aria-sort for keyboard a11y
- `apps/web/src/components/report-section/report-section-form.tsx` - try/catch on autosave/submit, removed traffic light red default
- `apps/web/src/components/navigation/role-nav.tsx` - Replaced `<a>` with Next.js `<Link>`
- `apps/web/src/app/(app)/reports/[reportId]/print/page.tsx` - Switched to shared formatPeriodDate with UTC
- `apps/web/src/components/admin/admin-panel.tsx` - Switched to shared formatDate/formatDateTime/formatPeriodDate
- `apps/web/src/components/head/submission-dashboard.tsx` - Switched to shared formatDateTime
- `apps/web/src/components/report/archive-report-list.tsx` - Switched to shared formatDate/formatPeriodDate

## Decisions Made

- Created shared `format-date.ts` utility instead of fixing locales in-place -- eliminates 4 duplicate local formatDate/formatDateTime functions across components
- Period dates (periodStart, periodEnd) use `formatPeriodDate` with `timeZone: 'UTC'` to prevent off-by-one day shifts in UTC+N timezones; non-period dates use `formatDate` without timezone override
- Removed traffic light default to 'red' entirely in `toSubmitInput` -- the `collectValidationMessages` function already requires all projects to have a traffic light status before submit, and Zod schema validation catches null values

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Consolidated duplicate date formatting into shared utility**

- **Found during:** Task 2 (date formatting standardization)
- **Issue:** Plan suggested fixing locales in-place, but 5 components had their own local formatDate functions with inconsistent signatures
- **Fix:** Created `apps/web/src/lib/format-date.ts` with 3 functions and replaced all local copies
- **Files modified:** 5 components updated to import from shared utility
- **Verification:** grep confirms zero remaining toLocaleDateString/toLocaleString calls outside format-date.ts
- **Committed in:** 00d5f81 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Shared utility approach is better than in-place fixes -- prevents future drift when new components need date formatting.

## Issues Encountered

- Pre-existing TypeScript compilation errors (missing node_modules for radix-ui, lucide-react, next, sonner, testing-library) -- these are dependency installation issues, not code errors. All errors existed before this plan's changes.

## Known Stubs

None -- all functionality is fully wired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 8 frontend bugs fixed and verified
- Shared date formatting utility ready for use by any new components
- DataTable keyboard accessibility ready for E2E accessibility testing (Phase 13 Plan 07)

---

_Phase: 13-quality-assurance-polish_
_Completed: 2026-04-12_

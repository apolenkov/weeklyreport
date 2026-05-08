---
phase: 12-e2e-tests-ci-cd
plan: 02
subsystem: testing
tags:
  [
    playwright,
    e2e,
    journey-tests,
    lead-workflow,
    head-workflow,
    pdf-export,
    admin-crud,
  ]

# Dependency graph
requires:
  - phase: 12-e2e-tests-ci-cd
    provides: "Per-role auth fixtures (leadPage, headPage, viewerPage) and dual webServer Playwright config"
provides:
  - "Full lead journey E2E test (fill -> autosave -> submit -> lock)"
  - "Full head journey E2E test (dashboard -> assembled report -> publish -> verify)"
  - "PDF export E2E test (publish -> trigger export -> verify download link)"
  - "Admin CRUD E2E test (users/projects/periods tabs with CrudSheet forms)"
  - "RBAC E2E test (lead denied access to admin panel)"
affects: [12-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      "self-contained E2E tests with setup steps",
      "ARIA selector strategy for shadcn/ui Radix primitives",
      "conditional test flow for idempotent re-runs",
    ]

key-files:
  created:
    - apps/web/e2e/journeys/lead-journey.spec.ts
    - apps/web/e2e/journeys/head-journey.spec.ts
    - apps/web/e2e/journeys/pdf-export.spec.ts
    - apps/web/e2e/journeys/admin-crud.spec.ts
  modified: []

key-decisions:
  - "ARIA-first selector strategy -- getByRole, getByLabel, getByText matching actual component markup"
  - "Self-contained tests -- each test publishes/creates data as needed rather than depending on test ordering"
  - "Conditional flows for idempotent re-runs -- check if already submitted/published before attempting"

patterns-established:
  - "Journey tests in e2e/journeys/ subdirectory, separate from legacy e2e/ specs"
  - "shadcn/ui Select: click trigger -> getByRole('option') for Radix select items"
  - "CrudSheet interaction: locate dialog role -> fill fields -> click submit button by label"
  - "ConfirmDialog: getByRole('dialog') scoping -> click confirm button by confirmLabel"

requirements-completed: [E2E-03, E2E-04, E2E-05, E2E-06]

# Metrics
duration: 5min
completed: 2026-04-11
---

# Phase 12 Plan 02: Full Journey E2E Tests Summary

**Four Playwright journey specs covering lead fill/submit, head review/publish, PDF export, and admin CRUD with ARIA-first selectors**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-11T22:15:47Z
- **Completed:** 2026-04-11T22:21:34Z
- **Tasks:** 2
- **Files created:** 4

## Accomplishments

- Lead journey test exercises full workflow: fill traffic lights, items, priorities -> autosave -> reload verify -> submit -> lock verify
- Head journey test exercises full workflow: dashboard with status table -> assembled report review -> publish with confirm dialog -> published report accessible
- PDF export test: publish report as head -> navigate as viewer -> trigger export -> poll for completion -> verify download link
- Admin CRUD test: users tab with Add User CrudSheet form -> projects tab with bootstrap -> periods tab with bootstrap
- RBAC test: lead navigating to /admin gets FORBIDDEN error displayed via QueryError component

## Task Commits

Each task was committed atomically:

1. **Task 1: Lead and Head journey E2E tests** - `de667d5` (feat)
2. **Task 2: PDF export and Admin CRUD E2E tests** - `834ede3` (feat)

## Files Created/Modified

- `apps/web/e2e/journeys/lead-journey.spec.ts` - Full lead workflow: fill section -> autosave -> submit -> verify locked
- `apps/web/e2e/journeys/head-journey.spec.ts` - Full head workflow: dashboard -> assembled report -> publish -> verify published
- `apps/web/e2e/journeys/pdf-export.spec.ts` - PDF export: publish setup -> trigger export -> poll status -> verify download
- `apps/web/e2e/journeys/admin-crud.spec.ts` - Admin CRUD: users/projects/periods tabs + RBAC denial test

## Decisions Made

- **ARIA-first selectors**: Used `getByRole('heading')`, `getByRole('table', { name })`, `getByRole('radio')`, `getByLabel()` matching the actual ARIA attributes in shadcn/ui components. Avoids fragile CSS class or text-content selectors.
- **Self-contained tests**: Each test handles its own setup (e.g., PDF export test publishes the report first). This prevents ordering dependencies between specs and supports parallel execution.
- **Conditional flows**: Tests check if actions already occurred (e.g., `publishButton.isVisible()`) before attempting them, making tests idempotent across re-runs.
- **Journeys subdirectory**: New tests placed in `e2e/journeys/` to distinguish from legacy v1.0 specs in `e2e/`. Legacy tests untouched per plan instructions.

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None -- all four test files are complete implementations with real selectors discovered from component source code.

## Next Phase Readiness

- All 4 E2E journey specs complete, ready for CI pipeline (plan 12-03)
- Tests use per-role auth fixtures from plan 12-01
- Playwright will discover journey specs automatically via testDir config
- Legacy e2e specs (7 files) remain in place; migration can happen in a future plan

## Self-Check: PASSED

All key files verified on disk. Both commit hashes found in git log.

---

_Phase: 12-e2e-tests-ci-cd_
_Completed: 2026-04-11_

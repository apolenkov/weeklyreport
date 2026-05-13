---
phase: 13-quality-assurance-polish
plan: "07"
subsystem: e2e-tests
tags: [e2e, playwright, regression, journeys]
dependency_graph:
  requires: [13-01, 13-02, 13-03]
  provides: [expanded-e2e-journey-specs, shared-e2e-utils]
  affects: [apps/web/e2e/journeys, apps/web/e2e/helpers]
tech_stack:
  added: []
  patterns: [fixture-based-auth, shared-test-utils, describe-grouped-specs]
key_files:
  created:
    - apps/web/e2e/helpers/test-utils.ts
    - apps/web/e2e/journeys/lead-report-entry.spec.ts
    - apps/web/e2e/journeys/head-publication.spec.ts
    - apps/web/e2e/journeys/admin-panel.spec.ts
    - apps/web/e2e/journeys/carry-over.spec.ts
    - apps/web/e2e/journeys/archive-history.spec.ts
  modified: []
decisions:
  - "New journey specs created at plan-specified paths (journeys/ dir) alongside existing specs"
  - "Shared test-utils extracted for reuse: waitForAutosave, expectToast, loginAs, submitSection, publishReport, expectRuLocaleDate"
  - "Tests use fixture-based auth pattern (leadPage, headPage, viewerPage) consistent with existing journey specs"
metrics:
  duration: 5m
  completed: "2026-04-12T11:16:00Z"
  tasks_completed: 2
  tasks_total: 2
  test_cases_added: 26
---

# Phase 13 Plan 07: Expanded E2E Journey Specs Summary

Expanded 5 Playwright E2E journey specs covering lead submission, head publication, admin panel, carry-over, and archive history with shared test utilities for regression scenarios from the 1788-scenario plan.

## What Was Done

### Task 1: Shared E2E utils + lead and head journey specs (5156104)

Created `apps/web/e2e/helpers/test-utils.ts` with 6 reusable functions:

- `waitForAutosave` -- waits for autosave indicator "Saved" state
- `expectToast` -- asserts Sonner toast notification appeared
- `loginAs` -- navigates via dev-login endpoint for role switching
- `submitSection` -- executes full submit section confirm dialog flow
- `publishReport` -- executes full publish report confirm dialog flow
- `expectRuLocaleDate` -- asserts dates use ru-RU locale (Cyrillic months)

Created `lead-report-entry.spec.ts` with 6 test cases:

1. Complete section fill + submit with traffic lights, items, priorities
2. Autosave indicator changes from Saving to Saved after typing
3. Validation feedback when submitting incomplete section
4. Draft persistence after reload
5. Submitted section is locked (read-only)
6. ru-RU formatted dates on report page (BUG-017 regression)

Created `head-publication.spec.ts` with 5 test cases:

1. Dashboard review showing all lead submissions with status
2. Head publishes report and status changes to "published"
3. Published report sections are read-only (no edit controls)
4. Assembled report shows all lead sections + portfolio overview
5. Published report accessible in archive view

### Task 2: Admin, carry-over, and archive journey specs (b4c5200)

Created `admin-panel.spec.ts` with 6 test cases:

1. Admin views user list with seeded users
2. Admin adds new user via CrudSheet (fill form, submit, verify toast + table)
3. Delete protection for users with report sections
4. Bootstrap project and period creation from CrudSheet
5. Admin views reminder rules list
6. DataTable sort headers toggle sort order (BUG-019 verification)

Created `carry-over.spec.ts` with 4 test cases:

1. Carry-over creates new sections from previous report
2. Carried-over items appear in lead form
3. Lead can edit carried-over items and add new ones
4. Carry-over is idempotent (running twice doesn't create duplicates)

Created `archive-history.spec.ts` with 5 test cases:

1. Published reports appear in archive list
2. Archive reports sorted by date (newest first)
3. Click archive report opens read-only view
4. Archive report shows all sections from all leads
5. Dates in archive display in ru-RU format (BUG-017 verification)

## Deviations from Plan

None -- plan executed exactly as written.

## Test Count Summary

| Spec File                 | Test Cases | Covers                                                           |
| ------------------------- | ---------- | ---------------------------------------------------------------- |
| lead-report-entry.spec.ts | 6          | Lead submission, autosave, validation, persistence, lock, locale |
| head-publication.spec.ts  | 5          | Dashboard, publish flow, read-only, content, archive             |
| admin-panel.spec.ts       | 6          | Users, add user, delete protection, bootstrap, reminders, sort   |
| carry-over.spec.ts        | 4          | Creation, population, edit, idempotency                          |
| archive-history.spec.ts   | 5          | List, sort, detail view, sections, locale                        |
| **Total new**             | **26**     |                                                                  |

Plus 4 existing journey specs (lead-journey, head-journey, admin-crud, pdf-export) with their own tests. Total journey specs: 9 files.

## Known Stubs

None -- all test cases are structurally complete with assertions. Tests use conditional guards (`if isDraft`) to handle varying seed data states gracefully.

## Self-Check: PASSED

All 6 created files exist and both commits verified.

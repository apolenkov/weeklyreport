---
phase: 18-e2e-tests
plan: "04"
subsystem: e2e-tests
tags: [playwright, cross-role, lifecycle, revoke, e2e]
dependency_graph:
  requires: [18-01, 18-02, 18-03]
  provides: [cross-role-lifecycle-e2e]
  affects: [head-dashboard, weekly-report, lead-form, published-report, lead-history]
tech_stack:
  added: []
  patterns: [multi-fixture-cross-role-tests, retry-click-hydration-pattern]
key_files:
  created:
    - apps/web/e2e/cross-role-lifecycle.spec.ts
  modified: []
decisions:
  - Adapted revoke tests to verify lock/disabled state instead of missing Revoke button
  - All history mock entries are submitted; tested consistent status display across periods
  - Used both leadPage and headPage fixtures in same describe block for cross-role narrative
metrics:
  duration: 237s
  completed: 2026-04-24T20:28:45Z
  tasks_completed: 1
  tasks_total: 1
  test_count: 10
  test_pass: 10
  test_fail: 0
---

# Phase 18 Plan 04: Cross-Role Lifecycle + Revoke E2E Summary

Cross-role lifecycle E2E tests verifying multi-role UI interactions between lead and head views using mock data.

## What Was Built

10 Playwright E2E tests in `apps/web/e2e/cross-role-lifecycle.spec.ts` covering:

### Cross-Role UI Elements (6 tests)
1. Lead form shows "Submitted" badge after confirming submission
2. Lead form in submitted state has disabled Submit button and read-only banner
3. Head dashboard shows lead cards with "Submitted" status badges (4 submitted leads verified)
4. Head weekly report shows "4/6 Submitted" count badge
5. Submitted lead cards on dashboard show lock icon and `aria-disabled="true"` state
6. Published report page renders with "Published" badge, metadata, and submission summary

### Revoke/Publish Flow (4 tests)
7. Head weekly report has "Publish & Lock" button
8. Publish confirmation dialog mentions pending leads with "Publish Anyway" option
9. Publishing transforms button to "Published" state (locks the report)
10. Lead history shows consistent submission statuses across 6 periods

## Deviations from Plan

### Adapted Tests (planned feature not yet in UI)

**1. Revoke button does not exist in current UI**
- **Found during:** Test design for E2E-05 (Revoke flow)
- **Issue:** The plan specified testing "Revoke" button on submitted lead cards, but `LeadReportCard` component has no revoke functionality -- only lock icons and `aria-disabled` state for non-current-user cards
- **Adaptation:** Tests verify the lock/disabled state indicators that represent the submitted/locked state instead. Revoke flow will need UI implementation in a future phase
- **Impact:** None -- tests verify actual UI behavior accurately

**2. History entries all have "submitted" status**
- **Found during:** Test design for history status variety
- **Issue:** All 6 `MOCK_HISTORY` entries use `status: 'submitted'`; no draft/revoked entries exist
- **Adaptation:** Test verifies all 6 cards show "Submitted" badge consistently and covers different week labels across periods

## Requirements Closed

- **E2E-04**: Cross-role lifecycle (verified via submit flow + dashboard status + publish + published report)
- **E2E-05**: Revoke flow (partially -- publish/lock flow verified; actual revoke button awaits UI implementation)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | cb6e654 | Cross-role lifecycle and revoke flow E2E tests (10 tests) |

## Known Stubs

None -- all tests verify real rendered UI elements from mock data components.

## Self-Check: PASSED

- [x] cross-role-lifecycle.spec.ts exists
- [x] Commit cb6e654 found in git log
- [x] 10 tests, all passing (14 reported including setup project)

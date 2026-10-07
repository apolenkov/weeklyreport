# Proposal

## Why

Overlapping reminder edits must remain usable, elapsed sends must stop appearing
as upcoming, and period navigation must stay valid after a refetch or touch
scroll. MR !72 introduced these behaviours without complete regression coverage
or the three contract deltas identified in the TASK-287.02 review.

## What Changes

- Extend `reminders-tab.test.tsx` with real mutation-lifecycle concurrency tests
  and a next-send clock regression for b70ed2a5b.
- Repair the additional lost-settlement callback defect reproduced by these
  tests; the owner authorized this minimal product change in the same branch.
- Extend `period-navigator.test.tsx` with shrinking-option, viewport-bound and
  horizontal-swipe regressions for 385265c71.
- Record the omitted reminder, period-listbox and head-envelope contracts in
  three deltas, grounded in their existing implementations and specifications.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-reminders-ui`: independent row busy lifecycle and per-render next-send
  calculation.
- `dialog-listbox-a11y`: valid active descendant after options shrink, bounded
  period panel and horizontally dominant swipe navigation.
- `head-report-visibility`: identity-matched live envelope projection into head
  navigation history.

## Impact

Test owners are the real `RemindersTab` and `PeriodNavigator` surfaces. The head
projection already has behavioural coverage in
`head-report-shell-periods.test.ts`. Baseline implementations are
`use-reminders-tab-state.ts`, `use-period-listbox-nav.ts`,
`use-listbox-panel-behavior.ts`, `period-listbox-panel.tsx` and
`head-report-periods.ts`. The source review is
`~/work/handoffs/mr-72-review-pi-07.10.md`.

## Non-goals

- Change OCR branches, the Lead form, dependencies or delivery configuration.
- Run E2E, reset databases, access Pi's shared synthetic records or merge MRs.
- Claim browser or visual acceptance from jsdom tests.

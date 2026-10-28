# Proposal

## Why

In the weekly report editors, asynchronous save operations must not be interrupted by discard dialog actions, and save actions must not allow double-submission while in flight. Specifically:

1. `useDiscardGuard` rendered `ConfirmationDialog` without passing `isPending`, so if an asynchronous operation entered pending state while the discard confirmation was already open, discard buttons and Escape remained active.
2. `RecordDialogFooter` provides `savePending` support to disable the Save button and indicate progress, but three editor dialogs (`ItemEditDialog`, `DecisionEditDialog`, and `RiskEditDialog`) did not wire `savePending={props.isPending}`, allowing repeated save clicks during network mutations.

## What Changes

- Pass `isPending` to `ConfirmationDialog` inside `useDiscardGuard` so that discard actions and dismissals are disabled when an action is in flight.
- Forward `savePending={props.isPending}` to `RecordDialogFooter` in `ItemEditDialog`, `DecisionEditDialog`, and `RiskEditDialog`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lead-dialog-lifecycle`: define pending-save protection for discard guards and dialog save buttons in lead editor dialogs.

## Impact

Affects:

- `apps/web/src/shared/ui/dialogs/use-discard-guard.tsx`
- `apps/web/src/features/report-sections/ui/item-edit-dialog.tsx`
- `apps/web/src/features/period/ui/decision-edit-dialog.tsx`
- `apps/web/src/features/review/ui/risk-edit-dialog.tsx`
- Colocated tests in `apps/web/`
  Tracking: TASK-503.85 (clauses C5249, C5269).

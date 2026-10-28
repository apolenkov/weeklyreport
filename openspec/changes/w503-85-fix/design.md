# Design

## Context

See proposal.md and specs/lead-dialog-lifecycle/spec.md.
Existing `useDiscardGuard` accepts `isPending` (defaults to `false`), preventing `requestClose` when active, but its internal `ConfirmationDialog` was instantiated without `isPending={isPending}`.
Existing `RecordDialogFooter` accepts `savePending` (defaults to `false`), which marks the save button as disabled with `Saving…` text and `aria-busy`.
Currently, `ItemEditDialog`, `DecisionEditDialog`, and `RiskEditDialog` accept `isPending` in their props, but did not forward it to `RecordDialogFooter` as `savePending`.

## Goals / Non-Goals

**Goals:**

- Pass `isPending` from `useDiscardGuard` to `ConfirmationDialog` (C5249).
- Pass `savePending={props.isPending}` (or `savePending={isPending}`) to `RecordDialogFooter` in `ItemEditDialog`, `DecisionEditDialog`, and `RiskEditDialog` (C5269).
- Add automated unit tests verifying that `ConfirmationDialog` receives `isPending` and that `RecordDialogFooter` receives `savePending`.

**Non-Goals:**

- Altering the backend API, tRPC routes, or server models.
- Changing dialog form submission logic or other buttons.

## Decisions

- **Decision 1: Direct forwarding of `isPending` in `useDiscardGuard`**
  `useDiscardGuard` already has `isPending` in its parameter list. Adding `isPending={isPending}` to `<ConfirmationDialog ... />` ensures the dialog disables its action buttons and guards outside interactions when `isPending` is true.
  _Alternative considered_: Auto-closing the discard dialog on pending save. Rejected because the confirmation dialog itself has built-in `isPending` support with focus parking and disabled controls.

- **Decision 2: Forwarding `savePending` to `RecordDialogFooter`**
  In `item-edit-dialog.tsx`, `decision-edit-dialog.tsx`, and `risk-edit-dialog.tsx`, pass `savePending={props.isPending}` (or `isPending` in scope) to `<RecordDialogFooter ... />`.
  _Alternative considered_: Disabling the whole dialog surface. Rejected because `DialogSurface` already has `isPending` support for opacity/interaction, but `RecordDialogFooter` provides the specific `Saving…` label and `disabled` state on the action button itself to prevent double submission.

## Risks / Trade-offs

- [Risk] Prop drilling or naming mismatch (`isPending` vs `savePending`) → Mitigation: `RecordDialogFooter` expects `savePending`, while dialog props use `isPending`. Wire `savePending={props.isPending}` (or `savePending={isPending}`). Tested via unit tests for each dialog.

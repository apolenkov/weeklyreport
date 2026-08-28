## MODIFIED Requirements

### Requirement: Hand-rolled confirmation dialogs MUST share one focus-trap/restore primitive

The shared `ConfirmationDialog` and `ConfirmDeleteDialog` surfaces MUST
delegate modal focus containment, focus lifecycle, Escape dismissal, backdrop
dismissal, portal mounting, and background isolation to one audited dialog
primitive. Applications MAY supply typed initial-focus and restore-focus
targets to that primitive, but MUST NOT reproduce modal semantics with
application-owned document listeners or focusable-element traversal.

Remaining hand-rolled feature dialogs SHALL integrate with the shared
`useDialogFocus` primitive
(`apps/web/src/shared/hooks/dialogs/use-dialog-focus.ts`) instead of
re-implementing Escape handling, Tab trapping, or focus restore per component.
This governs the inline delete-confirmation modal in `UsersTab`
(`apps/web/src/features/admin/ui/users-tab.tsx`), `FillFromConfirmDialog`
(`apps/web/src/features/period/ui/fill-from-confirm-dialog.tsx`), and
`PauseReasonDialog`
(`apps/web/src/features/period/ui/pause-reason-dialog.tsx`). Each remaining
hand-rolled dialog keeps its own backdrop-click handler wired to the same
`onClose`/`onCancel` callback the primitive uses for Escape, so Escape,
backdrop click, and the Cancel button all converge on one close path.

Shared confirmation dialogs MUST preserve their existing product contract:
Cancel receives initial focus for destructive confirmation, confirm and cancel
actions are disabled while pending, pending dialogs reject Escape and backdrop
dismissal, and close returns focus to the trigger.

#### Scenario: Shift+Tab does not escape ConfirmDeleteDialog

- **WHEN** ConfirmDeleteDialog is open and focus is on its first focusable
  control
- **AND** the user presses Shift+Tab
- **THEN** focus wraps to the dialog's last focusable control
- **AND** focus does not land on any element behind the backdrop

#### Scenario: Pending shared confirmation cannot be dismissed or repeated

- **WHEN** a shared confirmation dialog is open with an action pending
- **THEN** Escape and backdrop interaction do not close the dialog
- **AND** confirm and cancel controls cannot invoke either action again

#### Scenario: Shared confirmation restores focus after close

- **WHEN** a shared confirmation dialog closes by Cancel, Escape, backdrop
  interaction, or successful completion
- **THEN** focus returns to the control that opened the dialog

#### Scenario: UsersTab's delete modal closes on Escape and on backdrop click

- **WHEN** UsersTab's delete-confirmation modal is open
- **THEN** pressing Escape closes it and returns focus to the row's delete
  trigger
- **AND** clicking the backdrop also closes it and returns focus to the same
  trigger

#### Scenario: FillFromConfirmDialog closes on Escape and on backdrop click

- **WHEN** FillFromConfirmDialog is open
- **THEN** pressing Escape calls `onCancel` and returns focus to the trigger
  that opened it
- **AND** clicking the backdrop also calls `onCancel` and returns focus to the
  same trigger

#### Scenario: PauseReasonDialog traps Tab and restores focus on close

- **WHEN** PauseReasonDialog is open and focus is on its last focusable control
- **AND** the user presses Tab
- **THEN** focus wraps to the dialog's first focusable control, not to any
  element behind the backdrop

#### Scenario: PauseReasonDialog closes on Escape and on backdrop click

- **WHEN** PauseReasonDialog is open
- **THEN** pressing Escape closes it and returns focus to the control that
  opened it
- **AND** clicking the backdrop also closes it and returns focus to the same
  trigger

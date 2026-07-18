## MODIFIED Requirements

### Requirement: Hand-rolled confirmation dialogs MUST share one focus-trap/restore primitive

Every hand-rolled (non-Radix) confirmation dialog SHALL integrate with the
shared `useDialogFocus` primitive (`apps/web/src/lib/use-dialog-focus.ts`)
instead of re-implementing Escape handling, Tab trapping, or focus restore
per component. This governs `ConfirmDeleteDialog`
(`apps/web/src/shared/ui/confirm-delete-dialog.tsx`), the inline
delete-confirmation modal in `UsersTab`
(`apps/web/src/features/admin/ui/users-tab.tsx`),
`FillFromConfirmDialog`
(`apps/web/src/features/period/ui/fill-from-confirm-dialog.tsx`), and
`PauseReasonDialog`
(`apps/web/src/features/period/ui/pause-reason-dialog.tsx`). Each
dialog keeps its own backdrop-click handler wired to the same
`onClose`/`onCancel` callback the primitive uses for Escape, so Escape,
backdrop click, and the Cancel button all converge on one close path.

#### Scenario: Shift+Tab does not escape ConfirmDeleteDialog

- **WHEN** ConfirmDeleteDialog is open and focus is on its first focusable
  control
- **AND** the user presses Shift+Tab
- **THEN** focus wraps to the dialog's last focusable control
- **AND** focus does not land on any element behind the backdrop

#### Scenario: UsersTab's delete modal closes on Escape and on backdrop click

- **WHEN** UsersTab's delete-confirmation modal is open
- **THEN** pressing Escape closes it and returns focus to the row's delete
  trigger
- **AND** clicking the backdrop also closes it and returns focus to the
  same trigger

#### Scenario: FillFromConfirmDialog closes on Escape and on backdrop click

- **WHEN** FillFromConfirmDialog is open
- **THEN** pressing Escape calls `onCancel` and returns focus to the
  trigger that opened it
- **AND** clicking the backdrop also calls `onCancel` and returns focus to
  the same trigger

#### Scenario: PauseReasonDialog traps Tab and restores focus on close

- **WHEN** PauseReasonDialog is open and focus is on its last focusable
  control
- **AND** the user presses Tab
- **THEN** focus wraps to the dialog's first focusable control, not to any
  element behind the backdrop

#### Scenario: PauseReasonDialog closes on Escape and on backdrop click

- **WHEN** PauseReasonDialog is open
- **THEN** pressing Escape closes it and returns focus to the control that
  opened it
- **AND** clicking the backdrop also closes it and returns focus to the
  same trigger

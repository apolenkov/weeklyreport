# dialog-listbox-a11y

## Purpose

Keep hand-rolled dialogs, the period listbox, and popup/expander controls accessible via one shared focus/close primitive and correct ARIA relationships.

## Requirements

### Requirement: Hand-rolled confirmation dialogs MUST share one focus-trap/restore primitive

Every hand-rolled (non-Radix) confirmation dialog SHALL integrate with the
shared `useDialogFocus` primitive (`apps/web/src/shared/hooks/dialogs/use-dialog-focus.ts`)
instead of re-implementing Escape handling, Tab trapping, or focus restore
per component. This governs `ConfirmDeleteDialog`
(`apps/web/src/shared/ui/dialogs/confirm-delete-dialog.tsx`), the inline
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

### Requirement: The period listbox MUST adopt the shared primitive's close lifecycle and keep the active option visible

The period listbox (`apps/web/src/features/period/model/use-period-listbox-nav.ts`) MUST adopt `useDialogFocus` for its Escape-to-close and focus-restore-to-trigger lifecycle, and MUST scroll the currently active option into view whenever `activeIdx` changes via keyboard navigation.

The listbox is a combobox pattern — focus stays on the trigger button and
the active option is tracked via `aria-activedescendant`, not real DOM
focus — so only `useDialogFocus`'s Escape-to-close and
focus-restore-to-trigger lifecycle applies; its focus-move-into-container
and Tab-trap behavior do not apply to a panel with no focusable
descendants. The scroll-into-view requirement covers `ArrowUp`,
`ArrowDown`, `Home`, and `End` navigation, so the keyboard highlight never
scrolls outside the visible panel.

#### Scenario: Escape closes the period listbox and refocuses the trigger

- **WHEN** the period listbox is open
- **AND** the user presses Escape
- **THEN** the listbox closes
- **AND** focus returns to the trigger button

#### Scenario: ArrowDown navigation keeps the highlighted option visible

- **WHEN** the period listbox is open and the active option is scrolled
  outside the visible panel
- **AND** the user presses ArrowDown to move the highlight
- **THEN** the newly active option scrolls into view within the panel

### Requirement: Popup and expander controls MUST expose accurate ARIA relationships

`QuickAddButton`'s trigger MUST set `aria-haspopup` to a value consistent with the popup's actual rendered role, and `AccordionSection`'s toggle controls MUST each carry an `aria-controls` attribute referencing the panel they expand.

`QuickAddButton` (`apps/web/src/features/report-sections/ui/quick-add-button.tsx`)
currently claims `aria-haspopup="menu"` over a `role="group"` popup, which
must not disagree. `AccordionSection`
(`apps/web/src/shared/ui/report-shell/accordion-section.tsx`) must wire the
`aria-controls` id on both the header toggle and the trailing icon-button
toggle when both are rendered for the same panel, and that id must resolve
to a stable id on the collapsible panel.

#### Scenario: QuickAddButton's aria-haspopup matches its popup's role

- **WHEN** QuickAddButton's popup is inspected via the accessibility tree
- **THEN** the trigger's `aria-haspopup` value agrees with the popup's
  rendered `role`

#### Scenario: An accordion toggle references its panel via aria-controls

- **WHEN** an `AccordionSection` renders both a header toggle and a
  trailing icon-button toggle for the same panel
- **THEN** both toggles carry `aria-controls` set to that panel's id
- **AND** the id resolves to the actual collapsible panel element in the DOM

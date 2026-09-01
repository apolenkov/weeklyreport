# dialog-listbox-a11y

## Purpose

Keep hand-rolled dialogs, the period listbox, and popup/expander controls accessible via one shared focus/close primitive and correct ARIA relationships.

## Requirements

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
(`apps/web/src/features/period/ui/fill-from-confirmation.tsx`), and
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

`QuickAddButton`'s disclosure trigger MUST omit `aria-haspopup` because its
expanded content is a labelled `group`, not one of the popup roles accepted by
that attribute. `AccordionSection`'s toggle controls MUST each carry an
`aria-controls` attribute referencing the panel they expand.

`QuickAddButton` (`apps/web/src/features/report-pages/ui/lead/chrome/quick-add-button.tsx`)
MUST expose the expanded state through `aria-expanded` and the labelled group
relationship. `AccordionSection`
(`apps/web/src/shared/ui/report-shell/accordion-section.tsx`) must wire the
`aria-controls` id on both the header toggle and the trailing icon-button
toggle when both are rendered for the same panel, and that id must resolve
to a stable id on the collapsible panel. A content-bearing `ProductAccordion`
MUST likewise expose one stable toggle-to-region relationship. Its collapsed
content wrapper MUST be both `inert` and `aria-hidden` so its mounted controls
cannot remain interactive or enter the accessibility tree. An empty product
accordion renders no panel and MUST omit `aria-controls` rather than reference
a missing element. The Settings AI Provider disclosure and the Admin Product
stage-assignment and Activity lead-attachment disclosures MUST also expose a
stable `aria-controls` relationship to a region labelled by the corresponding
toggle. Admin row regions that stay mounted while collapsed MUST report their
hidden state to assistive technology.

#### Scenario: QuickAddButton exposes a group disclosure accurately

- **WHEN** QuickAddButton's popup is inspected via the accessibility tree
- **THEN** the trigger omits `aria-haspopup`, reports `aria-expanded`, and the
  expanded content exposes its labelled `group` role

#### Scenario: An accordion toggle references its panel via aria-controls

- **WHEN** an `AccordionSection` renders both a header toggle and a
  trailing icon-button toggle for the same panel
- **THEN** both toggles carry `aria-controls` set to that panel's id
- **AND** the id resolves to the actual collapsible panel element in the DOM

#### Scenario: A collapsed product report keeps mounted content inaccessible

- **WHEN** a content-bearing product report is collapsed
- **THEN** its toggle references a labelled region through stable
  `aria-controls` and `aria-labelledby` ids
- **AND** the region's immediate content wrapper is `inert` and `aria-hidden`
- **AND** expanding the product removes `inert` and exposes the content again

#### Scenario: An empty product report has no dangling panel relationship

- **WHEN** a product report has no renderable content
- **THEN** its disabled header omits `aria-controls`
- **AND** no product-content region is rendered for that header

#### Scenario: Settings and Admin disclosures identify their controlled regions

- **WHEN** an administrator inspects the AI Provider, Product stage-assignment,
  or Activity lead-attachment disclosure
- **THEN** the toggle's `aria-controls` resolves to the disclosed region
- **AND** the region's `aria-labelledby` resolves to that toggle
- **AND** a mounted collapsed Admin row region reports `aria-hidden="true"`

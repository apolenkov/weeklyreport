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
a missing element. The Admin Product stage-assignment and Activity
lead-attachment disclosures MUST also expose a
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

### Requirement: Nested dialogs MUST give keyboard ownership to the active surface

The shared `useDialogFocus` primitive MUST route Escape and Tab handling to the
active dialog surface. A lower shared-hook dialog MUST ignore a keyboard event
owned by a nested modal or already handled by another dialog implementation.
Nested shared-hook surfaces MUST close one level per Escape. Existing
single-dialog Escape dismissal, Tab containment and focus restoration MUST
remain unchanged.

#### Scenario: Users group confirmation owns the first Escape

- **GIVEN** an administrator has changed a user's group and other form fields
- **AND** the group-change confirmation is open above the edit dialog
- **WHEN** the administrator presses Escape
- **THEN** only the confirmation closes
- **AND** the edit dialog retains its changed group and other draft fields
- **AND** no save mutation is sent
- **WHEN** the administrator presses Escape again
- **THEN** the edit dialog closes

#### Scenario: Tab remains in the nested confirmation

- **GIVEN** the Users group-change confirmation is open above the edit dialog
- **WHEN** the administrator navigates forward across the confirmation actions
- **THEN** focus stays within the confirmation
- **AND** the lower edit dialog focus trap does not move focus into its fields

#### Scenario: Nested shared-hook dialogs close one level at a time

- **GIVEN** two shared-hook dialog surfaces are open with focus in the inner one
- **WHEN** the user presses Escape
- **THEN** only the inner surface closes
- **AND** a second Escape closes the outer surface

#### Scenario: An already handled Escape is ignored

- **GIVEN** an earlier keyboard owner prevented the Escape event's default
- **WHEN** the event reaches `useDialogFocus`
- **THEN** the shared hook does not invoke its close callback

### Requirement: Period listbox remains addressable when its options change

The `PeriodNavigator` combobox MUST keep its highlighted option within the
current option set after a refetch removes options. Its `aria-activedescendant`,
scroll target and Enter or Space selection MUST refer to the same surviving
option. An empty list MUST omit `aria-activedescendant` and MUST NOT navigate
on listbox selection keys.

#### Scenario: The highlighted last option is removed while the panel is open

- **GIVEN** the period listbox is open with its last option highlighted
- **WHEN** a refetch removes that option and leaves earlier options
- **THEN** the highlight clamps to the last surviving option
- **AND** the combobox's active descendant resolves to that option in its panel
- **AND** that option is scrolled into view while focus stays on the trigger
- **AND** Enter or Space selects that surviving period and closes the panel

#### Scenario: An open period list becomes empty

- **WHEN** a refetch removes all options from an open period listbox
- **THEN** the combobox omits its active descendant
- **AND** ArrowUp, ArrowDown, Home, End, Enter and Space do not navigate
- **AND** Escape remains available to close the panel

### Requirement: Period listbox bounds account for the viewport

The `PeriodNavigator` portaled listbox MUST adjust its left position to keep
the trigger-matched panel width inside a 16-pixel right viewport gutter when
the trigger is near the right edge. This bound MUST be recomputed on resize.
The panel MUST cap its maximum width at the viewport width minus 32 pixels
so long option labels cannot widen it beyond that limit.

#### Scenario: A right-edge trigger opens a bounded panel

- **GIVEN** a 320-pixel viewport and a trigger at left 250 with width 60
- **WHEN** the admin, head, lead or viewer opens the period listbox
- **THEN** its panel's left position is 244 pixels
- **AND** its minimum width matches the 60-pixel trigger
- **AND** its maximum width is constrained by the viewport's two gutters

#### Scenario: A viewport resize updates the panel bound

- **GIVEN** the same trigger and an open period listbox
- **WHEN** the viewport shrinks to 280 pixels
- **THEN** the panel's left position becomes 204 pixels

### Requirement: Period swipes distinguish navigation from vertical scrolling

The `PeriodNavigator` touch surface MUST navigate only for gestures with
horizontal displacement of at least 50 pixels and strictly greater magnitude
than vertical displacement. A left swipe MUST choose the next available
period and a right swipe the previous available period. Incomplete gestures
MUST NOT navigate, and each gesture MUST be consumed only once.

#### Scenario: Horizontal swipe reaches an adjacent period

- **GIVEN** both adjacent periods are available
- **WHEN** a gesture moves 50 pixels left with no vertical displacement
- **THEN** the navigator chooses the next period exactly once
- **AND** a qualifying right swipe chooses the previous period

#### Scenario: Vertical scrolling with sideways drift stays on the report

- **WHEN** a gesture moves 80 pixels horizontally and 100 pixels vertically
- **THEN** no period navigation occurs
- **AND** equally diagonal gestures and horizontal gestures under 50 pixels
  also leave the report unchanged

#### Scenario: An incomplete or repeated touch end is inert

- **WHEN** a touch end has no matching touch start or no changed touch
- **THEN** it does not navigate
- **AND** a second touch end after a consumed gesture does not navigate again

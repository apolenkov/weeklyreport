## MODIFIED Requirements

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

#### Scenario: Period choice uses primary activation

- **WHEN** a period option receives a primary click, a click-only activation, or a secondary/middle press
- **THEN** primary and click-only activation select once; secondary/middle presses do not navigate; trigger keyboard/focus behavior remains unchanged

### Requirement: Period listbox bounds account for the viewport

The `PeriodNavigator` portaled listbox MUST adjust its left position to keep
the trigger-matched panel width inside a 16-pixel right viewport gutter when
the trigger is near the right edge. This bound MUST be recomputed on resize.
The panel MUST cap its maximum width at the viewport width minus 32 pixels
so long option labels cannot widen it beyond that limit.
The panel MUST also stay within the vertical viewport gutters using the available space above or below its trigger, and MUST recompute that bound on resize.

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

#### Scenario: A bottom-edge trigger opens and resizes

- **WHEN** a visible bottom-edge trigger opens its period choices or the viewport resizes
- **THEN** the panel uses the available vertical space inside the existing viewport gutters, placing above when needed and allowing its options to scroll

# Spec Delta

## ADDED Requirements

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

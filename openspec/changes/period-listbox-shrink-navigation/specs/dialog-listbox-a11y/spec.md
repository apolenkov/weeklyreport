## MODIFIED Requirements

### Requirement: Period listbox remains addressable when its options change

The `PeriodNavigator` combobox MUST keep its highlighted option within the
current option set after a refetch removes options. Its `aria-activedescendant`,
scroll target and Enter or Space selection MUST refer to the same surviving
option. Arrow navigation MUST continue from that surviving highlighted option on the next key press. An empty list MUST omit `aria-activedescendant` and MUST NOT navigate
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

#### Scenario: ArrowUp continues from the surviving highlighted option

- **GIVEN** the period listbox is open with its last option highlighted
- **WHEN** a refetch removes one or several trailing options and leaves two options
- **AND** the user presses ArrowUp once
- **THEN** the first surviving option becomes the active descendant and scroll target
- **AND** focus stays on the trigger
- **AND** Enter or Space selects that first period and closes the panel

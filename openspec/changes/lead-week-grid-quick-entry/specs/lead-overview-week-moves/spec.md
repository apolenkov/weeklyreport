## MODIFIED Requirements

### Requirement: Overview week moves MUST be reachable from hover icons and keyboard shortcuts

Each editable Current or Next item MUST expose an icon row for every record: edit, a week-move arrow (to the other week) and discussion, with no overflow menu. The row shows on hover, focus or touch. An unavailable icon MUST stay in place, `aria-disabled` and focusable, with its reason; activating it or its Alt+Arrow shortcut changes nothing and announces the reason. Moves follow the placement-or-acknowledgement contract of `record-status-derivation`.

#### Scenario: the week-move icon moves an item

- **WHEN** the lead hovers an eligible Current item and activates its week-move arrow
- **THEN** the occurrence moves to Next through the canonical draft save path
- **AND** it keeps its stored progress, text, and stable identity

#### Scenario: a Next item is moved to Current

- **WHEN** the lead activates the week-move arrow on a Next item
- **THEN** the occurrence is placed in Current with its stored progress and text preserved
- **AND** no continuation verdict or Current result is synthesized

#### Scenario: an occupied target rejects the move

- **GIVEN** a Next occurrence with the same `stableId` already exists
- **WHEN** the lead moves the Current item to Next by arrow or keyboard
- **THEN** the move is refused with the reason "Next week already has this item" and no occurrence is written
- **AND** the item stays in its original week

#### Scenario: Alt+Arrow moves the focused card

- **GIVEN** keyboard focus is on an editable Current item card
- **WHEN** the lead presses Alt+ArrowRight
- **THEN** the card moves to Next and focus follows the moved card
- **WHEN** the lead then presses Alt+ArrowLeft while focus stays on the card
- **THEN** the card moves back to Current

#### Scenario: a shortcut with no applicable direction does nothing

- **GIVEN** keyboard focus is on a Current item card
- **WHEN** the lead presses Alt+ArrowLeft
- **THEN** no move is performed, nothing is announced, and the item stays Current
- **AND** no keyboard shortcut is applicable from or toward Last week content

#### Scenario: edit and comment icons reach the existing flows

- **WHEN** the lead activates the edit icon on an editable item
- **THEN** the canonical item editor opens in a dialog with that item selected
- **AND** no overflow menu is needed to reach edit, move or the in-place stage labels
- **WHEN** the lead activates the discussion icon
- **THEN** the existing record discussion flow opens for that record

#### Scenario: a refused move announces its reason

- **GIVEN** an item that cannot move, for one of the refusal conditions listed below
- **WHEN** the lead activates the disabled arrow or presses Alt+ArrowRight on it
- **THEN** the reason is announced as a message and nothing is moved or written
- **AND** the refusal conditions are: Done ("Done items stay in This week"); closed as Won't do ("Closed as Won’t do. Restore it first"); occupied target; derived row; read-only report ("Read-only report"); ended assignment; another person's item; and an unsaved or conflicting change ("Not saved yet. Retry or discard the change first")

#### Scenario: a touch user sees the reason as a message

- **GIVEN** a device without hover
- **WHEN** the user taps a disabled arrow or other unavailable icon
- **THEN** the reason is shown as a message, because tooltips do not open on touch
- **AND** nothing is changed

#### Scenario: a derived Next row offers Edit and discussion

- **GIVEN** a Next row derived from a next step of a This week item
- **WHEN** the row is rendered
- **THEN** Edit opens the source next step for editing
- **AND** the week-move arrow is disabled with the reason "Planned from a next step — edit the next step instead"
- **AND** the discussion icon opens the source record's shared discussion

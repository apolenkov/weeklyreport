## MODIFIED Requirements

### Requirement: Overview week moves MUST be reachable from hover icons and keyboard shortcuts

Each editable Current or Next item in the Report Overview MUST expose an icon cluster revealed on pointer hover and on keyboard focus within the item, and always visible on touch: the applicable week-move icon (toward Next for Current, toward Current for Next), an edit icon, and a comment icon, with no overflow menu. Eligible editable Current and Next Product items MUST instead expose directly visible, keyboard-operable labelled controls for the Lead's currently owned stages, including a singleton readout; Activity, Previously planned and unowned items MUST NOT offer stage mutation controls. Stage changes MUST use the canonical draft save path, preserve all other fields and MUST NOT remove the last stage. Keyboard operation MUST return focus to the triggering stage control. The week-move icon MUST move the occurrence through the canonical draft and autosave path, following the placement-or-acknowledgement contract in `record-status-derivation`; a move that would create a second active occurrence for the same `stableId` in the target week MUST be rejected without writing. With keyboard focus on the card, `Alt+ArrowRight` MUST move a Current item to Next and `Alt+ArrowLeft` MUST move a Next item to Current.

#### Scenario: the week-move icon moves an item

- **WHEN** the lead hovers an eligible Current item and activates its week-move icon
- **THEN** the occurrence moves to Next through the canonical draft save path
- **AND** it keeps its stored progress, text, and stable identity

#### Scenario: a Next item is moved to Current

- **WHEN** the lead activates the week-move icon on a Next item
- **THEN** the occurrence is placed in Current with its stored progress and text preserved
- **AND** no continuation verdict or Current result is synthesized

#### Scenario: an occupied target rejects the move

- **GIVEN** a Next occurrence with the same `stableId` already exists
- **WHEN** the lead moves the Current item to Next by icon or keyboard
- **THEN** the move is rejected and no occurrence is written
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
- **THEN** no move is performed and the item stays Current
- **AND** no keyboard shortcut is applicable from or toward Previously planned content

#### Scenario: edit and comment icons reach the existing flows

- **WHEN** the lead activates the edit icon on an editable item
- **THEN** the canonical item editor opens in a dialog with that item selected
- **AND** no overflow menu is needed to reach edit, move or the directly visible stage labels
- **WHEN** the lead activates the comment icon
- **THEN** the existing record comment flow opens for that record

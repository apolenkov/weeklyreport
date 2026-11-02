# lead-overview-week-moves Specification

## Purpose

Move a Lead Overview item between the current and next week in place — by drag
and drop, hover icons, keyboard shortcuts or touch — through the canonical draft
save, with Undo and server-state convergence.

## Requirements

### Requirement: Overview items MUST move between Current and Next by drag and drop

An editable Current or Next item in the Report Overview MUST be draggable, and dropping it on the other active week's column MUST move that occurrence there through the canonical draft and autosave path, following the placement-or-acknowledgement contract in `record-status-derivation`. A drop that would create a second active occurrence for the same `stableId` in the target week MUST be rejected without writing. The Previously planned column MUST NOT accept drops.

#### Scenario: a Current item is dropped into Next

- **WHEN** the lead drags an eligible Current item onto the Next column
- **THEN** the occurrence is placed in Next through the canonical draft save path
- **AND** it no longer occupies Current and keeps its stored progress, text, and stable identity
- **AND** the move follows the placement-or-acknowledgement contract in `record-status-derivation`

#### Scenario: a Next item is dropped into Current

- **WHEN** the lead drags a Next item onto the Current column
- **THEN** the occurrence is placed in Current with its stored progress and text preserved
- **AND** no continuation verdict or Current result is synthesized

#### Scenario: an occupied target rejects the drop

- **GIVEN** a Next occurrence with the same `stableId` already exists
- **WHEN** the lead drops the Current item onto the Next column
- **THEN** the drop is rejected and no occurrence is written
- **AND** the card returns to its original column

#### Scenario: Previous is not a drop target

- **WHEN** the lead drags a Current or Next item over the Previously planned column
- **THEN** no drop affordance is shown for that column
- **AND** releasing the pointer leaves the item in its original week

### Requirement: Overview week moves MUST be reachable from hover icons and keyboard shortcuts

Each editable Current or Next item in the Report Overview MUST expose an icon cluster revealed on pointer hover and on keyboard focus within the item, and always visible on touch: the applicable week-move icon (toward Next for Current, toward Current for Next), an edit icon, and a comment icon. The week-move icon MUST activate the same move contract as drag and drop. With keyboard focus on the card, `Alt+ArrowRight` MUST move a Current item to Next and `Alt+ArrowLeft` MUST move a Next item to Current.

#### Scenario: the week-move icon moves an item

- **WHEN** the lead hovers an eligible Current item and activates its week-move icon
- **THEN** the occurrence moves to Next through the canonical draft save path
- **AND** the overflow menu's week-move action remains available for the same result

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
- **THEN** the canonical item editor opens with that item selected
- **WHEN** the lead activates the comment icon
- **THEN** the existing record comment flow opens for that record

### Requirement: A completed week move MUST offer Undo in its notification

After a week move completed by drag, icon, or keyboard, the confirmation notification MUST offer an Undo action. Activating Undo MUST issue a reverse move of the same occurrence back to the week it occupied before the move, through the same canonical draft save path. If the reverse move is rejected, the notification MUST report the failure and the item MUST stay in the server's current week. Undo MUST NOT be offered for inline text edits.

#### Scenario: Undo returns the item to its week

- **WHEN** a drag move of an eligible Current item to Next completes
- **AND** the lead activates Undo in the move confirmation
- **THEN** the occurrence is moved back to Current through the canonical draft save path
- **AND** the notification confirms the return

#### Scenario: Undo is refused when the occurrence changed

- **GIVEN** a move to Next completed and its Undo is still available
- **AND** the occurrence was edited or moved again afterwards
- **WHEN** the lead activates Undo
- **THEN** no reverse move is applied
- **AND** the notification reports that the move can no longer be undone
- **AND** the item stays in the server's current week

### Requirement: Previously planned MUST remain neither a move source nor a move target

Previously planned content in the Report Overview MUST remain read-only with respect to week moves: a Previously planned item MUST NOT be draggable, MUST NOT expose a week-move icon or keyboard shortcut, and MUST NOT accept a drop. No direct-manipulation control MUST write to the previous period; every move writes only the selected week's occurrence through the canonical draft save path.

#### Scenario: no move control targets Previous

- **WHEN** Overview renders a Previously planned item
- **THEN** the item is not draggable, shows no week-move icon, accepts no drop, and no keyboard shortcut moves it
- **AND** its text, outcome, and lineage remain visible and unchanged

#### Scenario: a move writes only the selected week's occurrence

- **WHEN** the lead moves an item between Current and Next by drag, icon, or keyboard
- **THEN** the write goes through the canonical draft save path of the selected section
- **AND** no row in the previous period is created or modified

### Requirement: Concurrent Overview moves MUST converge on the server state

When the same editable draft is open in two tabs, the server draft save MUST be the source of truth for week moves and text edits. A tab whose save is rejected as stale MUST revert the affected card to the last server state, announce the standard save-failure error, and re-synchronize the Overview from the server. The rollover invariant of at most one active W+1 occurrence per `stableId` MUST hold after every committed save.

#### Scenario: a stale move is rejected and the card reverts

- **GIVEN** the same editable draft is open in two tabs
- **AND** one tab's move has already committed and advanced the section version
- **WHEN** the other tab drops or activates a move for the same item
- **THEN** the server rejects its save as stale
- **AND** the tab reverts the card to the last server state and announces the standard save-failure error
- **AND** no duplicate occurrence is created and the Overview re-synchronizes from the server

#### Scenario: the rollover invariant survives concurrent moves

- **GIVEN** concurrent moves and edits on items sharing a `stableId`
- **WHEN** every committed draft save completes
- **THEN** at most one active Next occurrence exists for that `stableId`
- **AND** both tabs show the same server state after re-synchronization

### Requirement: Overview item actions MUST be operable on touch devices

On a touch device, Report Overview item actions MUST NOT depend on pointer hover: the icon cluster MUST be visible without hover and operable by tap, and tapping the item's text MUST open the inline editor. A drag on touch MUST start with a long press on the card's drag handle so scrolling and tapping stay unambiguous; a released touch drag MUST complete or cancel the move like a pointer drag.

#### Scenario: icons are visible and tappable without hover

- **WHEN** the Overview renders editable items on a touch device
- **THEN** each item's icon cluster is visible without hover
- **AND** tapping the week-move icon performs the move and tapping the edit icon opens the canonical editor

#### Scenario: a touch drag starts with a long press

- **GIVEN** a touch device
- **WHEN** the lead long-presses an editable card's drag handle, drags the card onto the other week's column, and releases
- **THEN** the move is applied through the canonical draft save path
- **AND** a plain swipe or tap on the card or its handle starts no drag and performs no move

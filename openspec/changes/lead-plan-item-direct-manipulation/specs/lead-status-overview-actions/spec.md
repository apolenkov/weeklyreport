# Spec Delta: lead-status-overview-actions

## MODIFIED Requirements

### Requirement: Overview MUST expose one primary progress interaction per active item

The `/lead/report/:reportId` Report Overview MUST keep the three temporal columns and the canonical item editor. Each editable Current or Next item MUST rest as one status icon followed by its text, with at most a small stage badge in a corner; it MUST NOT render permanent text action buttons or a metadata line. The status icon MUST be the one primary progress/status interaction and MUST open a menu of statuses, because a cycling click would pass over statuses that need a reason. Secondary actions (edit details, move between weeks, resolve) MUST be reachable from one overflow control that is revealed on pointer hover, on keyboard focus within the item, and on tap, and MUST stay in the accessibility tree and keyboard order while visually hidden. Week moves MUST be reachable both from that overflow menu and from a dedicated week-move icon on the item (toward Next for a Current item, toward Current for a Next item), revealed on pointer hover and on keyboard focus within the item and always visible on touch; the icon MUST stay in the accessibility tree and keyboard order while visually hidden on pointer devices and MUST NOT be rendered for Previously planned content. Updating an unconfirmed carried item through the status interaction MUST clear its unconfirmed marker; it MUST NOT require a separate Confirm action. Previously planned content MUST remain read-only: no control in that column edits, moves or changes the status of the prior-week occurrence; the verdict controls defined by `lead-plan-verdict` write only the selected week's occurrence.

#### Scenario: an unconfirmed carried item is shown

- **WHEN** Overview renders a carried Current item that the lead has not updated in the selected week
- **THEN** its status icon visibly marks it as continued or planned but not updated this week
- **AND** the status interaction lets the lead update it without a separate Confirm action

#### Scenario: an ordinary active item is shown

- **WHEN** Overview renders an editable Current or Next item with no restore or historical-replan state
- **THEN** it shows only the status icon, its text and an optional stage badge
- **AND** no text button and no metadata line is visible

#### Scenario: actions are revealed on hover, focus and tap

- **WHEN** the lead hovers the item, moves keyboard focus into it, or taps it
- **THEN** the overflow control and the dedicated week-move icon become visible
- **AND** the week-move icon offers the move toward the other active week, matching the item's placement
- **AND** keyboard users reach the control, the icon, and the menu actions with Tab without a hover
- **AND** touch users see them without any hover requirement

#### Scenario: prior week remains read-only

- **WHEN** Overview renders Previously planned content
- **THEN** no control edits, moves or changes the status of the prior-week occurrence
- **AND** its text, outcome and lineage remain visible
- **AND** verdict controls, when shown, change only the selected week's occurrence

#### Scenario: keyboard operation preserves context

- **WHEN** the lead operates the status interaction or cancels the canonical editor with a keyboard
- **THEN** focus returns to the triggering item control or the Overview heading
- **AND** the three-column lineage remains visible without document-level horizontal overflow

## ADDED Requirements

### Requirement: Overview items MUST support inline text editing in place

On an editable lead draft at `/lead/report/:reportId`, clicking the description text of an editable Current or Next item MUST open an inline text editor in place without opening the canonical item editor. Saving MUST use the canonical draft and autosave path for that item's description, preserving progress, placement, and stable identity. Previously planned, submitted, locked, historical, or foreign items MUST NOT offer inline editing.

#### Scenario: a lead edits an item text in place

- **WHEN** the lead clicks the description text of an owned Current item in an editable draft
- **THEN** the text becomes an inline editor in place and the canonical item editor does not open
- **AND** pressing Enter saves the edited text through the canonical draft save path
- **AND** the item keeps its progress, placement, and stable identity

#### Scenario: Esc cancels and Shift+Enter adds a line

- **GIVEN** the inline editor is open on an item
- **WHEN** the lead edits the text and presses Shift+Enter
- **THEN** the editor inserts a line break without saving
- **WHEN** the lead then presses Esc
- **THEN** the item returns to its last saved text and no draft patch is emitted

#### Scenario: clicking outside saves non-empty text

- **GIVEN** the lead edited the item text to a non-empty value
- **WHEN** the lead clicks outside the field
- **THEN** the edited text is saved and the card shows the edited text

#### Scenario: empty text is not saved

- **GIVEN** the lead cleared the item text to empty or whitespace-only
- **WHEN** the lead activates save by Enter or a click outside
- **THEN** no draft patch is emitted
- **AND** the item displays its previous text

#### Scenario: read-only items are not inline editable

- **WHEN** the lead clicks the text of a Previously planned item, or of a submitted, locked, historical, or foreign record
- **THEN** no inline editor opens
- **AND** activating the read-only text cannot emit a draft patch

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

On a touch device, Report Overview item actions MUST NOT depend on pointer hover: the icon cluster MUST be visible without hover and operable by tap, and tapping the item's text MUST open the inline editor. A drag on touch MUST start with a long press on the card so scrolling and tapping stay unambiguous; a released touch drag MUST complete or cancel the move like a pointer drag.

#### Scenario: icons are visible and tappable without hover

- **WHEN** the Overview renders editable items on a touch device
- **THEN** each item's icon cluster is visible without hover
- **AND** tapping the week-move icon performs the move and tapping the edit icon opens the canonical editor

#### Scenario: a touch drag starts with a long press

- **GIVEN** a touch device
- **WHEN** the lead long-presses an editable card, drags it onto the other week's column, and releases
- **THEN** the move is applied through the canonical draft save path
- **AND** a plain swipe or tap on the card starts no drag and performs no move

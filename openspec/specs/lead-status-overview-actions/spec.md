# lead-status-overview-actions Specification

## Purpose

Keep Lead Overview item editing, context-preserving editors, contextual creation
and the item progress interaction on one canonical authoring path.

## Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

The editable Lead Report Overview MUST use the existing item editor and canonical draft-save path for Current/Next editing and creation. Creation and detail editing MUST follow the dialog requirement. Previously planned and ineligible sections MUST remain read-only.

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead activates Add item for an editable Product
- **THEN** the existing editor opens in a dialog with that Product and the chosen week selected
- **AND** saving uses the existing `DraftPatch`, autosave, optimistic version, authorization, and lifecycle paths
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead activates Add item for an editable Activity
- **THEN** the same editor opens with that Activity selected and no Product-stage requirement
- **AND** saving uses the canonical draft and autosave path

#### Scenario: An Overview cell is not writable

- **WHEN** a cell is Previously planned or its section is submitted, locked, historical, or foreign
- **THEN** no Add or Edit action is rendered for that cell
- **AND** activating its content cannot emit a draft patch

### Requirement: Overview MUST edit current-period items through the canonical editor

For an editable lead draft, Current week and Next week items MUST open the
existing item editor without leaving Overview. Saving MUST update the one
canonical lead draft and MUST use its existing `DraftPatch`, autosave, optimistic
version, authorization, and lifecycle paths. Previously planned MUST remain
immutable. Submitted, locked, historical, and foreign records MUST NOT expose an
Overview write action. Full-authoring workflows MUST remain reachable within
Report through its inline controls and canonical details editor, without a
separate Edit mode.

#### Scenario: A lead edits a current item from Overview

- **WHEN** the lead activates an owned Current week item in an editable draft
- **THEN** the existing item editor opens on the same Overview page
- **AND** saving applies the change through the canonical draft and autosave path
- **AND** the compact projection reflects the live draft change

#### Scenario: A lead edits a next item from Overview

- **WHEN** the lead activates an owned Next week item in an editable draft
- **THEN** the same canonical item editor opens with Next week status rules
- **AND** no Overview-specific mutation or autosave path is used

#### Scenario: An item is not editable

- **WHEN** an item belongs to Previously planned or the section is submitted, locked, historical, or foreign
- **THEN** Overview renders it without an edit action
- **AND** activating the read-only content cannot emit a draft patch

#### Scenario: A save held back by a lost connection is announced in the open editor

- **GIVEN** the inline editor is open and its Save update is paused because the browser is offline
- **WHEN** the status region renders
- **THEN** it announces that the lead is offline and that changes save when the connection returns
- **AND** it does not show only the generic unsaved-update copy

#### Scenario: The submit-readiness summary cannot claim a paused save is in flight

- **GIVEN** the draft autosave is paused because the browser is offline
- **WHEN** the "Before you submit" summary renders
- **THEN** its autosave line explains the offline pause and that changes save when the connection returns
- **AND** it does not claim that draft changes are actively saving

#### Scenario: Discarding an editor after a failed save reverts the board

- **GIVEN** Save update applied an edit to the draft and the save failed
- **WHEN** the lead keeps the editor open
- **THEN** the typed text is retained and saving can be retried
- **WHEN** the lead then cancels the editor and confirms Discard
- **THEN** the edited row returns to its last saved fields, or a newly created row is removed
- **AND** the discarded text is not part of any later autosave payload

### Requirement: Overview plan composer MUST warn on unload only while input is edited

The Overview plan composer MUST warn before page unload or in-app navigation
only while its input differs from the state it opened with. The outcome choice
alone MUST NOT arm the warning, matching the composer's discard confirmation.
A pristine composer MUST NOT prompt.

#### Scenario: A pristine composer does not prompt on unload

- **GIVEN** the Overview plan composer has just opened with no edited input
- **WHEN** the page is unloaded
- **THEN** the unload proceeds without a browser confirmation

#### Scenario: Edited input arms the unload warning

- **GIVEN** the Overview plan composer is open
- **WHEN** the lead edits any input field beyond the outcome choice
- **THEN** page unload is prevented while the composer is open

#### Scenario: Restoring the opened input disarms the warning

- **GIVEN** the lead has edited the composer input
- **WHEN** the input is restored to the values the composer opened with
- **THEN** page unload proceeds without a browser confirmation

### Requirement: Discarding a failed Overview edit MUST save the restored text

When the lead cancels an Overview editor whose Save update failed and confirms
Discard, the draft save issued by Discard MUST carry the restored item fields,
not the abandoned text. The save MUST run after the restore patch has reached
the draft engine.

#### Scenario: Discard after a failed Save update

- **GIVEN** the lead edited an item's description in Overview and Save update failed
- **WHEN** the lead cancels the editor and confirms Discard
- **THEN** the draft save issued by Discard contains the item's last saved text
- **AND** it does not contain the abandoned text

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

### Requirement: Overview create save MUST land focus on the new item

After a successful plain "Save update" in the Overview composer's create mode, the
composer MUST close and keyboard focus MUST move to the newly created item's own
Overview control, identified by the saved item's stable identity, with that item
scrolled into view. If that control is not rendered, focus MUST return to the control
that opened the composer, and otherwise to the Overview heading. Focus MUST NOT land
on a control of a different reporting unit. Cancel, edit-mode saves and "Save and add
another" keep their existing focus behaviour. The Overview MUST show a unit's
items in the same durable identity order that report reads return, so a saved item
does not move when the confirmed section is read back.

#### Scenario: A new item is saved in a unit with several rows

- **WHEN** the lead creates an item with "Save update" in a product that already shows several Current rows
- **THEN** the composer closes and keyboard focus is on the new item's control
- **AND** the new item is inside the visible scroll area
- **AND** focus is not on a control of the next product

#### Scenario: The saved item stays in place after the read-back

- **WHEN** a create save succeeds and the confirmed section is read back in durable identity order
- **THEN** the new item keeps the position it had right after the composer closed
- **AND** it stays inside the visible scroll area

#### Scenario: The new item's control is unavailable

- **WHEN** a create save succeeds but the new item's control is not rendered
- **THEN** focus returns to the control that opened the composer, or to the Overview heading if that control is gone

#### Scenario: Other composer exits are unchanged

- **WHEN** the lead cancels the composer, saves an edit, or uses "Save and add another"
- **THEN** focus follows the existing rules for that action

### Requirement: Overview cards MUST expose their actions flat, one click and one menu level

The `/lead/report/:reportId` Report Overview MUST keep the three temporal columns. Each editable Current or Next item MUST rest as one status icon followed by its text, with its stage badges below the text. The status icon MUST open a menu of statuses; when the item can take a terminal outcome, that same menu MUST end with an outcome entry that opens the existing outcome flow, and no separate "Update status" entry MUST exist. The outcome entry MUST follow the existing eligibility: never on Previous rows, an unconfirmed carry, or a derived Next projection. On pointer hover, keyboard focus within the item, or an open control, a row of icon buttons MUST appear without changing the card's layout or the text's width (on hover devices it floats over the card's corner and steps aside while the inline text editor has focus): Edit (pencil), the week move, the stage label control for Product items whose unit owns more than one stage, the record comment action, and the Plan or Restore recovery action where it applies. Hidden controls MUST stay in the accessibility tree and the Tab order. No control on a Current or Next card MUST open a nested menu, and no overflow menu MUST exist there; the Previously planned verdict controls of `lead-plan-verdict` keep their own menu. On devices without hover the row MUST be visible at all times. The stage control MUST list only the unit's owned stages, MUST write through the current draft with every other item field preserved, and MUST NOT remove a Product item's last stage. Activity items MUST NOT render a stage control. Operating the status menu or a row control with a keyboard MUST return focus to the triggering control, and the three-column lineage MUST stay visible without document-level horizontal overflow. Updating an unconfirmed carried item through the status menu MUST clear its unconfirmed marker without a separate Confirm action. Previously planned content MUST remain read-only: no control in that column edits, moves or changes the status of the prior-week occurrence; the verdict controls defined by `lead-plan-verdict` write only the selected week's occurrence.

#### Scenario: an ordinary active item is shown

- **WHEN** Overview renders an editable Current or Next item with no restore or historical-replan state
- **THEN** it shows the status icon, its text and its stage badges
- **AND** no text button and no metadata line is visible until hover or focus

#### Scenario: actions appear on hover without moving the layout

- **WHEN** the lead hovers the item or moves keyboard focus into it
- **THEN** Edit, the week move and the stage control become visible in one row
- **AND** the card and its neighbours keep their size and position
- **AND** no "More actions" control is rendered

#### Scenario: the status menu holds the outcome

- **GIVEN** an editable Current item that can be resolved
- **WHEN** the lead opens its status menu
- **THEN** the progress statuses and one outcome entry are listed in that single menu
- **AND** choosing the outcome entry opens the existing outcome flow

#### Scenario: the stage label is set on the card

- **GIVEN** an editable Product item
- **WHEN** the lead opens its stage control and checks a stage owned by the unit
- **THEN** the item's stages update through the canonical draft save path
- **AND** the control lists only the unit's owned stages, one level deep

#### Scenario: the last stage cannot be removed

- **GIVEN** an editable Product item with one stage
- **WHEN** the lead opens its stage control
- **THEN** that stage cannot be unchecked and the control says a Product update needs a stage
- **AND** no draft patch is emitted

#### Scenario: an Activity item has no stage control

- **WHEN** Overview renders an editable Activity item
- **THEN** its action row has no stage control

#### Scenario: keyboard operation preserves context

- **WHEN** the lead operates the status menu or a row control with a keyboard, or closes a dialog
- **THEN** focus returns to the triggering item control or the Overview heading
- **AND** the three-column lineage remains visible without document-level horizontal overflow

#### Scenario: an unconfirmed carried item is shown

- **WHEN** Overview renders a carried Current item that the lead has not updated in the selected week
- **THEN** its status icon visibly marks it as continued or planned but not updated this week
- **AND** the status menu lets the lead update it without a separate Confirm action

#### Scenario: prior week remains read-only

- **WHEN** Overview renders Previously planned content
- **THEN** no control edits, moves or changes the status of the prior-week occurrence
- **AND** verdict controls, when shown, change only the selected week's occurrence

#### Scenario: touch shows the row without hover

- **WHEN** the Overview renders editable items on a device without hover
- **THEN** each item's action row is visible and every control has a touch-size target

### Requirement: Overview create and edit MUST open in a dialog

Creating an Overview item and editing an item's details MUST open the canonical item editor in a modal dialog over the Overview; the timeline grid MUST NOT change height while the editor is open. Creation MUST start from the unit header `Add item to <unit name>` control, whose dialog seeds the unit and offers the Current or Next week, defaulting to Current; direct Next creation MUST start with editable Planned progress. Editable Overview cells MUST NOT render per-cell or per-row create controls. At most one editor MUST be open, selected by stable identity with record-ID fallback and source. Escape, the close button and an outside click MUST take the same discard and save-recovery path as Cancel. Closing the dialog MUST return focus to the control that opened it unless a create save moves focus to the new item.

The dialog MUST offer "Save and add another" in create mode (button and `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`). Upon successful save it MUST stay open for the same unit and week with cleared text fields and focus in the description field. If validation or save fails, entered input MUST be preserved. In edit mode, "Save and add another" MUST NOT be rendered.

#### Scenario: an update is created

- **WHEN** the lead activates `Add item to <unit name>`
- **THEN** a dialog opens with that unit selected and Current preselected
- **AND** the Overview grid keeps its height and position behind the dialog

#### Scenario: A new item is created directly in Next

- **WHEN** the lead chooses Next in the create dialog
- **THEN** Planned progress is selected and can be changed before saving
- **AND** saving unchanged defaults emits one Next item with `workflowStatus=planned`

#### Scenario: an item is edited

- **WHEN** the lead activates Edit on an editable Current or Next item
- **THEN** the canonical editor opens in a dialog with that item selected
- **AND** closing it returns focus to the Edit control

#### Scenario: a dirty dialog is dismissed

- **GIVEN** the lead typed into the create or edit dialog
- **WHEN** the lead presses Escape or clicks outside the dialog
- **THEN** the same discard confirmation as Cancel is shown and nothing is saved without it

#### Scenario: no cell offers creation

- **WHEN** Overview renders an editable unit
- **THEN** no timeline cell or lineage row renders an Add control
- **AND** the unit header Add item control remains, also on mobile

#### Scenario: Save and add another successfully saves and prepares a new item

- **WHEN** the lead enters a valid item and activates "Save and add another" (or presses Ctrl+Shift+Enter / Cmd+Shift+Enter)
- **THEN** the item is submitted to the canonical draft save path
- **AND** upon save completion the dialog stays open for the same unit and week with empty description and next step
- **AND** keyboard focus is placed into the description field

#### Scenario: Save and add another validation failure retains input

- **WHEN** the lead activates "Save and add another" while required fields are missing or invalid
- **THEN** client validation blocks the submission and displays field errors
- **AND** the typed input is preserved and the dialog does not reset or close

#### Scenario: Save and add another failure during persistence retains input

- **WHEN** "Save and add another" submits a valid item but the draft save fails
- **THEN** the dialog displays the save failure message
- **AND** the typed input is retained for retry

#### Scenario: Edit mode does not expose Save and add another

- **WHEN** the lead opens an existing item in edit mode
- **THEN** "Save and add another" is not rendered
- **AND** `Ctrl+Shift+Enter` does not trigger batch creation

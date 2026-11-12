## MODIFIED Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

Editable Lead Overview MUST create This week and Next week items through the quiet entry line of each eligible unit and week, bound to that owner and week, using the canonical draft-save, authorization and lifecycle paths. Editing MUST use the in-place editor, with the canonical item editor in a modal Sheet behind More details. Last week and ineligible sections remain read-only.

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead submits a valid entry in an editable Product's This week or Next week entry line
- **THEN** the item is bound to that Product and week
- **AND** saving uses existing draft patch, autosave, optimistic version, authorization and lifecycle paths
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead submits a valid entry in an editable Activity's This week or Next week entry line
- **THEN** the item is bound to that Activity with no Product-stage requirement
- **AND** saving uses the canonical draft and autosave path

#### Scenario: An Overview cell is not writable

- **WHEN** a cell is Last week or its section is submitted, locked, historical, or foreign
- **THEN** no entry line is rendered and no write action is available for that cell
- **AND** activating its content cannot emit a draft patch

### Requirement: Overview MUST edit current-period items through the canonical editor

For an editable lead draft, the text of a This week or Next week record MUST open the in-place editor, and More details MUST open the canonical item editor as a modal Sheet, without leaving Overview. Saving MUST use the existing draft patch, autosave, optimistic version, authorization and lifecycle paths. Last week stays immutable; submitted, locked, historical and foreign records MUST NOT expose a write action. Full authoring stays reachable within Report without a separate Edit mode.

#### Scenario: A lead edits a current item from Overview

- **WHEN** the lead activates the text of an owned This week record in an editable draft
- **THEN** the in-place editor opens on the same Overview page
- **AND** saving applies the change through the canonical draft and autosave path
- **AND** the compact projection reflects the live draft change

#### Scenario: A lead edits a next item from Overview

- **WHEN** the lead activates the text of an owned Next week record in an editable draft
- **THEN** the in-place editor opens without a Status field
- **AND** no Overview-specific mutation or autosave path is used

#### Scenario: An item is not editable

- **WHEN** an item belongs to Last week or the section is submitted, locked, historical, or foreign
- **THEN** Overview renders it without a write action
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

## REMOVED Requirements

### Requirement: Overview items MUST support inline text editing in place

**Reason**: Mockup v2.5 replaces the text-only inline editor with an in-place editor that also holds stage, Next step and the text actions, and that does not save on blur; the old scenario `clicking outside saves non-empty text` contradicts it.
**Migration**: Use "Overview records open an in-place editor" below. Enter saving, Shift+Enter, Escape and the empty-text and read-only rules are kept there.

### Requirement: Overview cards MUST expose their actions flat, one click and one menu level

**Reason**: Mockup v2.5 removes the per-record pencil, move arrow and discussion buttons and the hover row. The text opens an in-place editor, and status, stage and week moves are reached through the status menu, the stage label and the editor.
**Migration**: Use "Overview records open an in-place editor", "Overview status menu offers the outcomes of its context" and "Owned product stages are directly selectable in context" below.

### Requirement: Overview create save MUST land focus on the new item

**Reason**: Enter saves the entry line and keeps it ready for the next item, so focus stays in the line. Moving focus to the saved item conflicts with that flow.
**Migration**: Use "Overview creation is inline and detailed edit remains modal" below. Read-back order is still governed by the durable identity order of report reads.

### Requirement: Overview create and edit MUST open in a dialog

**Reason**: The owner requested creation in the This week or Next week context with a quiet entry line, superseding header-only modal creation. Detailed editing continues in a modal Sheet.
**Migration**: Replace the unit-header-only create entry with the week-specific entry line. Preserve canonical modal editing, safe cancellation, failure recovery and the existing separate toolbar flows.

## ADDED Requirements

### Requirement: Overview creation is inline and detailed edit remains modal

Overview MUST create This week and Next week items in the entry line of each editable unit, including empty units, and MUST NOT offer a separate Add control. Last week MUST offer no creation. More details MUST open the canonical item editor as a modal Sheet with the entry's draft. Only one item editor may be open, selected by stable identity with physical-ID fallback and source; focus, dismissal, validation and save recovery MUST remain deterministic.

#### Scenario: Create a This week item inline

- **WHEN** a Lead types in the `Add what happened — <unit>, This week` entry line of an eligible Product and presses Enter
- **THEN** the item is saved with that Product and This week fixed and with Done progress
- **AND** the line clears and keeps focus, and the new record's status control is available right after saving

#### Scenario: A new item is created directly in Next

- **WHEN** a Lead types in the `Plan something — <unit>, Next week` entry line of an eligible Activity and presses Enter
- **THEN** one Next item bound to that Activity is saved with `workflowStatus=planned` and shows no status
- **AND** the line clears and keeps focus

#### Scenario: An item is edited in detail

- **WHEN** the Lead activates More details in the in-place editor of an eligible record, or in an entry line that holds text
- **THEN** the canonical editor opens as a modal Sheet named `Edit details: <text>` holding the same draft text, stages and Next step, and the page below becomes inert
- **AND** closing returns focus to More details

#### Scenario: A dirty editor is dismissed

- **WHEN** a dirty in-place editor is cancelled or a dirty detailed Sheet receives Escape, outside click, close button or Cancel
- **THEN** an AlertDialog asks `Discard changes?` and the existing save-recovery protections apply
- **AND** Keep editing returns to the editor with the input intact

#### Scenario: Save and add another succeeds

- **WHEN** the Lead enters a valid item in the detailed editor and activates Save and add another, or presses Ctrl+Shift+Enter / Cmd+Shift+Enter
- **THEN** the item is persisted through the canonical draft path and the editor remains for the same owner and week
- **AND** the entry fields clear and focus returns to the description only if the current input still matches the confirmed submitted snapshot
- **AND** newer input typed while the save was pending is retained and is not claimed as part of the confirmed item

#### Scenario: Save and add another fails

- **WHEN** validation fails or persistence fails during Save and add another
- **THEN** the editor retains typed values, identifies the failure, does not clear or announce success and supports correction or retry without duplication

#### Scenario: Edit mode does not expose Save and add another

- **WHEN** the Lead opens the detailed editor for an existing item
- **THEN** Save and add another is not rendered and its shortcut does not create an item

#### Scenario: Creation is unavailable

- **WHEN** a unit or section is foreign, historical, submitted, locked or otherwise ineligible
- **THEN** it offers no entry line or edit mutation controls

### Requirement: Overview records open an in-place editor

Activating a record's text MUST open an editor in place, holding in order: text, stage, Next step (This week only), Save and Cancel, then the text actions More details, Move…, Discussion (N) and Delete. Enter saves and Shift+Enter adds a line. Leaving the editor MUST NOT save: the draft stays, is marked unsaved and blocks Submit. Cancel or Escape with changes MUST ask `Discard changes?`; an empty text is never saved.

#### Scenario: The text control opens the editor in place

- **WHEN** the lead activates the text button `Edit text: <text>, This week` of an editable record
- **THEN** the text becomes a field at the same place, with no popover over neighbouring records and no Sheet
- **AND** the controls follow the stated order, Stage appears for a Product record only, and Next step only for a This week record

#### Scenario: Enter saves and Escape cancels

- **WHEN** the lead presses Enter in the field
- **THEN** the edited text, stage and Next step are saved through the canonical draft path, keeping the record's progress, placement and stable identity
- **WHEN** the lead presses Shift+Enter, or Enter during IME composition
- **THEN** a line break is inserted and nothing is saved
- **WHEN** the lead presses Escape with no changes
- **THEN** the editor closes and no draft patch is emitted

#### Scenario: Empty text is not saved

- **WHEN** the lead clears the text and activates Save or Enter
- **THEN** no draft patch is emitted, the field shows `The text can’t be empty. Press Esc to cancel.` and the record keeps its previous text

#### Scenario: Leaving the editor keeps the draft unsaved

- **WHEN** focus leaves the editor after the lead changed text, stage or Next step
- **THEN** nothing is saved, the draft stays in place marked `Unsaved changes`, and `Before you submit` lists it
- **AND** the draft survives a tab switch and opening a Sheet

#### Scenario: Next step feeds the plan of the next week

- **WHEN** the lead saves a Next step in a This week record
- **THEN** Next week shows it as the derived `Next step` line of the same row and the This week result is kept
- **AND** when Next week already holds a record of the same work, the Next step field is read-only with the reason `Next week already has this item`

#### Scenario: Delete asks first

- **WHEN** the lead activates Delete
- **THEN** an AlertDialog asks `Delete this entry?` and, on confirmation, the record is removed and an Undo is offered under the one Undo rule
- **AND** when the work item was already published in an earlier report, Delete is aria-disabled with `Published in last week’s report. It can’t be deleted`, and the work can only be closed through the Won’t do outcome

#### Scenario: A derived next step opens a reduced editor

- **WHEN** the lead activates the text of a derived `Next step` line
- **THEN** the editor holds only the step text, Save changes only the next step, and Delete asks `Delete this next step?` and removes only that step while the item stays
- **AND** Move… is aria-disabled with `A next step stays with its item. Edit the next step instead`, Discussion opens the source record's discussion, and More details opens the Sheet of the source record at its Next step

#### Scenario: Unavailable actions say why

- **WHEN** the record is read-only, foreign, lost or unsaved and the lead opens its editor
- **THEN** the text shows read-only and Save, More details, Move… and Delete that cannot apply are aria-disabled with their reason, shown as a visible line and as the accessible description
- **AND** activating one by pointer, Enter or touch announces that reason and changes nothing

### Requirement: Overview status menu offers the outcomes of its context

The status icon of a This week record MUST open one menu: Done, In progress, Not started, Paused…, Postponed, a separator, Move to next week, and Won’t do…. Paused… and Won’t do… MUST ask one line of reason in the row before saving. A Next week record has no status menu. An unavailable item MUST stay in the menu, aria-disabled, with its reason in view; it MUST NOT be hidden.

#### Scenario: A status is chosen

- **WHEN** the lead chooses Done, In progress, Not started or Postponed
- **THEN** the status is saved through the canonical draft path in one activation, the icon updates, and focus returns to the status icon
- **AND** Postponed is a stored status, not a week move

#### Scenario: Paused asks for a reason

- **WHEN** the lead chooses Paused…
- **THEN** a one-line reason is requested in the row with Save and Cancel, and an empty reason is refused with `One line is enough, but it can’t be empty.`
- **AND** on Save the record is Paused with the reason shown on its line

#### Scenario: Won’t do closes with audit

- **WHEN** the lead chooses Won’t do… and saves a reason
- **THEN** the record closes through the existing outcome flow with its audit event, shows `Won’t do` with the reason, and offers Restore until submission
- **AND** it is neither deleted nor given a new progress status value

#### Scenario: A covering risk keeps its lock

- **WHEN** a covering risk locks the record's status
- **THEN** the locked items stay in the menu, aria-disabled, with the reason and a way to the covering risk
- **AND** no menu path writes around the lock

#### Scenario: Menu keyboard operation

- **WHEN** the lead operates the menu by keyboard
- **THEN** arrow keys, Home and End move between items, Enter chooses, and Escape closes it
- **AND** focus returns to the status icon

#### Scenario: A disabled item announces its reason

- **WHEN** the lead activates an unavailable item by pointer, Enter or touch
- **THEN** its reason is announced, a touch user sees it as a message at the bottom of the screen, and nothing changes

### Requirement: Owned product stages are directly selectable in context

The stage label of a Product record MUST be a text button that opens its owned stages in place as checkboxes with Apply and Cancel, so stages change without the Sheet. Selection MUST respect ownership, the minimum of one stage and lifecycle validation, and MUST NOT change Product stage assignments. An Activity record has no stage control. In the in-place editor a stage change is a draft until Save.

#### Scenario: Choose an available stage while creating an item

- **GIVEN** a product has multiple stages currently assigned to the Lead
- **WHEN** the Lead types in an entry line for that product and week
- **THEN** the stage label appears with the text and opens the owned stages
- **AND** choosing one associates that stage with the intended item without opening the Sheet

#### Scenario: A sole owned stage is unambiguous

- **GIVEN** exactly one eligible stage is assigned to the Lead for the product
- **WHEN** a new item is started in that context
- **THEN** the stage is applied by the established default and shown as plain text without a menu

#### Scenario: Select an owned stage on an existing item

- **GIVEN** an eligible editable Product record in This week or Next week
- **WHEN** the Lead activates its stage label, checks stages and activates Apply
- **THEN** the canonical draft save updates its stages while preserving all other fields
- **AND** focus returns to the stage label and the last selected stage cannot be removed: Apply is aria-disabled with `Choose at least one stage.`

#### Scenario: Ineligible items cannot change stages

- **WHEN** a record is an Activity, in Last week, foreign, submitted, locked, historical or otherwise ineligible
- **THEN** it offers no stage mutation control

#### Scenario: A stage-only change in the editor is a draft

- **WHEN** the lead applies a stage inside the in-place editor and does not save
- **THEN** the draft is marked unsaved, blocks Submit and is saved only with Save

#### Scenario: A selected stage becomes unavailable

- **WHEN** a previously selected stage is no longer eligible before saving
- **THEN** the selection and user input remain visible with an explanation and an explicit way to remove the stale selection
- **AND** the write is blocked until the choice is valid

### Requirement: Overview rows are aligned and quiet

Within a work-item row the first line of every cell MUST start within 2 CSS pixels of the others at 1280 and 1728, and the three columns MUST have equal width. Colour MUST mark only risk severity and what blocks submission. Hover MUST NOT highlight anything, a visible keyboard focus MUST remain, and one line above the table MUST read `Click text to edit. Use status to answer a plan.` Entry lines MUST have no fill and no resting border.

#### Scenario: Cells in a row are aligned

- **WHEN** a unit renders records, entry lines or empty cells at 1280 or 1728 CSS pixels
- **THEN** the first line of each cell of a row starts within 2 CSS pixels of the others
- **AND** entry text in a column shares one left edge

#### Scenario: Hover changes nothing

- **WHEN** the pointer hovers any record, status, stage label or entry line
- **THEN** no highlight, fill or action appears, while the cursor, a tooltip naming the control, the keyboard focus ring and the pressed state remain

#### Scenario: An item with several stages

- **WHEN** a Product record has several stages
- **THEN** all stage names are shown as muted text right after the description, wrapping together with it

#### Scenario: A unit at rest offers few controls

- **WHEN** a unit is shown on desktop at rest
- **THEN** it offers at most four controls of its own: the two entry lines, `+ Risk or decision` and the counts toggle
- **AND** in the active week of the tabs layout it offers at most three

#### Scenario: Touch targets

- **WHEN** the Overview renders on a coarse pointer or in the tabs layout
- **THEN** every control is at least 44 by 44 CSS pixels and a stage label may take its own line so that targets do not overlap

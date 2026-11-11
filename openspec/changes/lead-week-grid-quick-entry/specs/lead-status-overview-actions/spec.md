## MODIFIED Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

Editable Lead Overview MUST create Current and Next items through the always-present entry line of each eligible cell, bound to that owner and week, using the canonical draft-save, authorization and lifecycle paths. Detailed editing MUST use the canonical item editor in a modal Sheet. Previously planned and ineligible sections remain read-only.

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

- **WHEN** a cell is Previously planned or its section is submitted, locked, historical, or foreign
- **THEN** no entry line or Edit action is rendered for that cell
- **AND** activating its content cannot emit a draft patch

## REMOVED Requirements

### Requirement: Overview cards MUST expose their actions flat, one click and one menu level

**Reason**: Mockup v2.4 drops the hover row and the card-level More actions. Text opens the quick edit, the pencil opens the detailed form, and the status, week-move and discussion controls sit in one fixed, always visible column.
**Migration**: Use "Overview records have fixed actions and in-place quick edit" below.

### Requirement: Overview create save MUST land focus on the new item

**Reason**: In v2.4 Enter saves the entry line and keeps it ready for the next item, so focus stays in the line. Moving focus to the saved item conflicts with that flow.
**Migration**: Use "Overview creation is inline and detailed edit remains modal" below. Read-back order is still governed by the durable identity order of report reads.

### Requirement: Overview create and edit MUST open in a dialog

**Reason**: The owner requested creation in the Current or Next grid context with inline entry, superseding header-only modal creation. Detailed editing continues to use the canonical dialog.
**Migration**: Replace the unit-header-only create entry with the week-specific inline entry. Preserve canonical modal editing, safe cancellation, failure recovery and the existing separate toolbar flows.

## ADDED Requirements

### Requirement: Overview creation is inline and detailed edit remains modal

Overview MUST create Current and Next items in the entry line of each editable unit cell, including empty units, and MUST NOT offer a separate Add control. Previously planned MUST offer no creation. Eligible existing items MUST keep the canonical detailed editor as a modal Sheet. Only one item editor may be open, selected by stable identity with physical-ID fallback and source; focus, dismissal, validation and save recovery MUST remain deterministic.

#### Scenario: Create a Current item inline

- **WHEN** a Lead types in the `Add what happened — <unit>, This week` entry line of an eligible Product and presses Enter
- **THEN** the item is saved with that Product and Current week fixed and with Done progress, which the status control can change afterwards
- **AND** the line clears and keeps focus, ready for the next item

#### Scenario: A new item is created directly in Next

- **WHEN** a Lead types in the `Plan something — <unit>, Next week` entry line of an eligible Activity and presses Enter
- **THEN** one Next item bound to that Activity is saved with `workflowStatus=planned` and shows no visible status
- **AND** the line clears and keeps focus

#### Scenario: Entry line keys

- **WHEN** a Lead is typing in an entry line
- **THEN** Enter saves, Shift+Enter inserts a line break without saving, and Escape clears the text and offers Undo
- **AND** leaving the line with non-empty text saves it

#### Scenario: An item is edited in detail

- **WHEN** the Lead activates the pencil of an eligible Current or Next item
- **THEN** the canonical editor opens as a modal Sheet named `Edit details: <text>`, and the page below becomes inert
- **AND** closing returns focus to the pencil

#### Scenario: A dirty editor is dismissed

- **WHEN** a dirty entry line is cancelled or a dirty detailed Sheet receives Escape, outside click, close button or Cancel
- **THEN** an AlertDialog asks `Discard changes?` and the existing save-recovery protections apply
- **AND** Cancel in that dialog returns to the editor with the input intact

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

### Requirement: Overview records have fixed actions and in-place quick edit

Each editable This week and Next week record MUST show its text, a text control that opens in-place quick edit, a pencil that opens the detailed Sheet, a status control (This week only), a week-move control and a discussion control, all in one fixed column that is always visible. Hover MUST NOT reveal, hide or move any action. Unavailable actions stay in place as aria-disabled controls with their reason.

#### Scenario: The text control opens quick edit

- **WHEN** the lead activates the text control of an editable record
- **THEN** the text becomes an input in place and the detailed Sheet does not open
- **AND** Enter saves through the canonical draft path and keeps the item's progress, placement and stable identity
- **AND** Escape returns the item to its last saved text with no draft patch, and an empty value is never saved

#### Scenario: The pencil opens the detailed Sheet

- **WHEN** the lead activates the pencil of an editable record
- **THEN** the detailed form opens as a modal Sheet named `Edit details: <text>`

#### Scenario: Hover changes nothing

- **WHEN** the pointer hovers a record or keyboard focus enters it
- **THEN** no action appears, disappears or moves, and the record keeps its size
- **AND** every action is visible on pointer and touch devices alike

#### Scenario: A Next week record has no status control

- **WHEN** a Next week record is shown
- **THEN** its fixed column holds the pencil, the week-move control and the discussion control, and no status control

#### Scenario: Read-only and locked records expose no write action

- **WHEN** a Last week record is shown
- **THEN** it exposes no action
- **WHEN** a submitted, lost or foreign record is shown
- **THEN** its actions stay in place as aria-disabled controls whose reason is the tooltip, the accessible description, and the text announced on activation

#### Scenario: Focus returns to the trigger

- **WHEN** the lead operates a record control with a keyboard or closes its Sheet
- **THEN** focus returns to the triggering control or to the Overview heading

### Requirement: Overview undo follows one rule

Undo of an Overview record change MUST be offered only after its save is confirmed. It MUST be refused with a stated reason while the item is saving, being edited, changed after that change, or holding a reply draft in its discussion, and it MUST NOT overwrite text typed since the change.

#### Scenario: Undo after a confirmed save

- **WHEN** a change to a record is confirmed and the lead activates Undo
- **THEN** the record returns to its previous value and the change is announced

#### Scenario: Undo while the item is saving

- **WHEN** the lead activates Undo while the record is still saving
- **THEN** Undo is refused with `Still saving. Try Undo in a moment.` and nothing changes

#### Scenario: Undo while the item is being edited

- **WHEN** the lead activates Undo while the item has unsaved quick-edit input
- **THEN** Undo is refused with `Can’t undo while this item is being edited. Save or cancel first.` and the input is kept

#### Scenario: Undo after a later change

- **WHEN** the record changed after the change being undone
- **THEN** Undo is refused with `Can’t undo: this item changed after that.` and the record is unchanged

#### Scenario: Undo while a discussion holds a draft

- **WHEN** the record's discussion holds typed or saved-draft reply text
- **THEN** Undo is refused with `Can’t undo while a reply is being written in its discussion. Send or clear it first.`

#### Scenario: Restoring text never overwrites newer text

- **WHEN** restoring a previous text would replace text typed since the change
- **THEN** the restore is refused and the typed text is kept

### Requirement: Owned product stages are directly selectable in context

An eligible lead MUST see currently owned Product stages as selectable labels where a Product item is created or changed, and MUST change stages of editable items in place without the detailed Sheet. Selection MUST respect ownership, minimum-stage and lifecycle validation.

#### Scenario: Choose an available stage while creating an item

- **GIVEN** a product has multiple stages currently assigned to the Lead
- **WHEN** the Lead begins creating an item for that product and week
- **THEN** available stages are presented as directly selectable labelled controls
- **AND** choosing one associates that stage with the intended item without opening a separate details editor

#### Scenario: A sole owned stage is unambiguous

- **GIVEN** exactly one eligible stage is assigned to the Lead for the product
- **WHEN** a new item is started in that context
- **THEN** the stage is applied by the established default and remains visible

#### Scenario: Select an owned stage on an existing item

- **GIVEN** an eligible editable Current or Next Product item
- **WHEN** the Lead activates the item's stage text and selects an owned stage by pointer or keyboard
- **THEN** the canonical draft save updates its stages while preserving all other item fields
- **AND** keyboard focus returns to the triggering control and the last selected stage cannot be removed

#### Scenario: A sole owned stage on an existing item

- **WHEN** an eligible Product item has exactly one currently owned stage
- **THEN** its stage name remains visible as text without opening a menu or details editor
- **AND** the last selected stage cannot be removed

#### Scenario: Ineligible items cannot change stages

- **WHEN** an item is an Activity, Previously planned, foreign, submitted, locked, historical or otherwise ineligible
- **THEN** it offers no stage mutation controls

#### Scenario: A selected stage becomes unavailable

- **WHEN** a previously selected stage is no longer eligible before saving
- **THEN** the selection and user input remain visible with an explanation and an explicit way to remove the stale selection
- **AND** the write is blocked until the choice is valid

### Requirement: Overview reads in the Lead's order of work

The Overview MUST show one `Before you submit` list of blockers, reached from Submit, that names each blocker on its own line and links it to its unit or item. No second blocker line or copy of the same blockers MAY exist. Week, save state, Submit, column headers and the current unit name MUST stay visible while scrolling.

#### Scenario: Blockers are listed once

- **WHEN** the report has items that block submission
- **THEN** `Before you submit` names each blocker once: unsaved entries, carried plans that need a status, `<unit>: no update this week`, risk or decision drafts that need details, and changes not saved
- **AND** activating a line expands the owning unit and focuses that item

#### Scenario: Unanswered plans are a note, not a blocker

- **WHEN** a prior-week plan has no answer
- **THEN** `Before you submit` states that unanswered plans are sent as Not answered, and the plan does not count in `N to fix`

#### Scenario: Typed text blocks submission instead of being lost

- **WHEN** an entry line or editor holds any unsaved change, or a save is pending, and the Lead activates Submit
- **THEN** submission is blocked, the list names the unsaved entry with a link to it, and the input is kept

#### Scenario: Submit moves focus to the list

- **WHEN** Submit is aria-disabled with blockers and the Lead activates it
- **THEN** focus moves to `Before you submit`

#### Scenario: Header and unit stay in view

- **WHEN** the Lead scrolls a long report
- **THEN** week, save state, Submit, column headers and the current unit name remain visible

#### Scenario: Narrow screens use week tabs

- **WHEN** the Overview renders at 375 CSS pixels
- **THEN** the tabs are Last week, This week and Next week with This week open
- **AND** the This week tab shows the number of unanswered plans, and its plan questions show labelled answers in a 44 px strip
- **AND** there is no document-level horizontal overflow and every control has a touch-size target

### Requirement: Overview rows are aligned and quiet

Within a unit row, the unit name and the first line of every temporal cell MUST start within 2 CSS pixels of each other at 1280 and 1728 CSS pixels, and a plan and its continuation MUST share one row line. Records not linked to a plan MUST start below all plan rows, and empty slots beside plans MUST stay blank. Colour MUST mark only risk severity and what blocks submission. A unit's risks and decisions MUST appear as a count under the unit name that expands their rows in place.

#### Scenario: Cells in a unit row are aligned

- **WHEN** a unit row renders entries, entry lines or empty cells at 1280 or 1728 CSS pixels
- **THEN** the first line of each cell and the unit name start within 2 CSS pixels of each other
- **AND** entry text in a column shares one left edge

#### Scenario: A continuation shares the plan's line

- **WHEN** a plan is answered Continue or Next week, or is a carried continuation
- **THEN** the continuation's top and first text line are within 2 CSS pixels of the plan's line

#### Scenario: An unanswered plan leaves its line empty

- **WHEN** a plan has no answer
- **THEN** the space beside it in This week and Next week stays empty, with no dash or placeholder
- **AND** the entry line of the cell sits after the cell's last row

#### Scenario: Unlinked records start below the plan rows

- **WHEN** a unit has records that are not linked to a plan
- **THEN** they start below the last plan row of that unit, on a strict row grid

#### Scenario: An item with several stages

- **WHEN** a Product item has several stages
- **THEN** all its stage names are shown as muted text right after the description, wrapping together with the description

#### Scenario: Risks collapse to a count

- **WHEN** a unit has risks or decisions
- **THEN** a count with the highest severity shows under the unit name and expands the rows in place on activation

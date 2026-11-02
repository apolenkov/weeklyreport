# lead-status-overview-actions Specification

## Purpose

Keep Lead Overview item editing, context-preserving editors, contextual creation
and the item progress interaction on one canonical authoring path.

## Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

The editable Lead Report Overview MUST use the existing item editor and canonical draft-save path for Current/Next editing and creation. Contextual creation MUST follow the separate contextual-create requirement. Previously planned and ineligible sections MUST remain read-only.

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead activates Add for an editable Product Current or Next period
- **THEN** the existing editor opens on the same page with that Product and week selected
- **AND** saving uses the existing `DraftPatch`, autosave, optimistic version, authorization, and lifecycle paths
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead activates Add for an editable Activity Current or Next period
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

### Requirement: Overview editing MUST preserve context and use the timeline width

Status Overview MUST keep its compact reading grid while one matching editor spans the timeline below its lineage at multi-lane widths. Selection MUST use stable identity with record-ID fallback and source. Header and contextual creation MUST share one unit composer region. Idle units MUST NOT render a footer solely for Add.

#### Scenario: a linked Current item is edited

- **WHEN** the lead activates Update progress or Edit details for a linked Current item
- **THEN** exactly one matching editor spans the three timeline columns below its lineage
- **AND** Previous, Current, Next, unmatched lineage rows, and other units remain visible
- **AND** closing returns focus to the triggering control

#### Scenario: an independent update is edited

- **WHEN** the lead edits an unlinked Current or Next update
- **THEN** its matching editor spans the timeline below the source row
- **AND** sibling timeline cells stay visible and matching uses stable identity or record ID together with source

#### Scenario: an update is created

- **WHEN** the lead activates the unit-header Add item control or contextual Current/Next creation
- **THEN** exactly one composer spans the timeline in that unit's composer region
- **AND** header Add item retains its accessible name `Add item to <unit name>` and Current default; contextual creation seeds its selected week
- **AND** closing or acknowledging creation restores the idle composer region

### Requirement: Overview contextual creation MUST seed Current or Next through one composer

Editable Overview Current/Next cells MUST offer contextual `+` creation seeded to unit and week, visible on hover/focus and always on touch. When mobile empty lanes are collapsed, equivalent Current/Next controls MUST live in the unit header. These controls MUST supplement header Add item and share its composer. Direct Next creation MUST start with editable Planned progress.

The item creation composer and dialog MUST offer a "Save and add another" action (accessible via button and keyboard shortcut `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`). In create mode, activating "Save and add another" MUST validate and submit the item via the canonical draft save path. Upon successful save, the composer MUST remain open seeded to the same reporting unit, section, and week with cleared text fields and focus returned to the description field. If save fails or validation fails, entered input MUST be preserved and the composer MUST NOT be cleared. In edit mode, "Save and add another" MUST NOT be rendered.

#### Scenario: Contextual creation is reachable without hover

- **WHEN** the lead focuses an eligible Current/Next create control or uses a touch device
- **THEN** that control is visible and operable without hover
- **AND** its accessible name identifies creation, unit, and week
- **AND** pointer hover reveals the same cell action on desktop

#### Scenario: A new item is created directly in Next

- **WHEN** the lead activates the Next contextual `+`
- **THEN** one composer opens with that unit, Next, and Planned selected
- **AND** the lead can change progress before saving
- **AND** saving unchanged defaults emits one Next item with `workflowStatus=planned`, without rewriting an existing item's progress

#### Scenario: An empty Next lane has a mobile creation target

- **WHEN** empty lanes are collapsed on mobile, including an entirely empty unit
- **THEN** the unit header contains always-visible touch controls for Current and Next creation, labelled with unit and week
- **AND** Next creation is available without mounting a hidden-lane composer or first opening a Current composer
- **AND** the general header Add item action remains and no Previous create action is offered

#### Scenario: Save and add another successfully saves and prepares a new item

- **WHEN** the lead enters a valid item in the Overview composer and activates "Save and add another" (or presses Ctrl+Shift+Enter / Cmd+Shift+Enter)
- **THEN** the item is submitted to the canonical draft save path
- **AND** upon save completion, the composer remains open for the same reporting unit and week
- **AND** description and next step fields are empty
- **AND** keyboard focus is placed into the description field

#### Scenario: Save and add another validation failure retains input

- **WHEN** the lead activates "Save and add another" while required fields are missing or invalid
- **THEN** client validation blocks the submission and displays field errors
- **AND** the typed input is preserved in the composer
- **AND** the composer does not reset or close

#### Scenario: Save and add another failure during persistence retains input

- **WHEN** "Save and add another" submits a valid item but server draft save encounters an error
- **THEN** the editor displays the save failure message
- **AND** the typed input is retained in the composer for retry

#### Scenario: Edit mode does not expose Save and add another

- **WHEN** the lead opens an existing item in edit mode
- **THEN** "Save and add another" is not rendered
- **AND** `Ctrl+Shift+Enter` does not trigger batch creation

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

## REMOVED Requirements

### Requirement: Overview MUST expose one primary progress interaction per active item

**Reason**: The owner asked for every card action on hover with at most one menu level (2026-11-02); the overflow menu it required is gone.

**Migration**: "Overview cards MUST expose their actions flat, one click and one menu level" replaces it with the same status, read-only and keyboard rules.

### Requirement: Overview editing MUST preserve context and use the timeline width

**Reason**: An editor expanding inside the grid moves the layout; the owner asked for pop-up editing.

**Migration**: "Overview create and edit MUST open in a dialog" replaces it.

### Requirement: Overview contextual creation MUST seed Current or Next through one composer

**Reason**: The owner removed the per-cell `+` controls; creation starts from the unit header only.

**Migration**: "Overview create and edit MUST open in a dialog" keeps header creation, the week choice and "Save and add another".

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Overview cards MUST expose their actions flat, one click and one menu level

The `/lead/report/:reportId` Report Overview MUST keep the three temporal columns. Each editable Current or Next item MUST rest as one status icon followed by its text, with its stage badges below the text. The status icon MUST open a menu of statuses; when the item can take a terminal outcome, that same menu MUST end with an outcome entry that opens the existing outcome flow, and no separate "Update status" entry MUST exist. The outcome entry MUST follow the existing eligibility: never on Previous rows, an unconfirmed carry, or a derived Next projection. On pointer hover, keyboard focus within the item, or an open control, a row of icon buttons MUST appear in space the card already reserves, so showing it changes no layout: Edit (pencil), the week move, the stage label control for Product items, the record comment action, and the Plan or Restore recovery action where it applies. Hidden controls MUST stay in the accessibility tree and the Tab order. No control on a Current or Next card MUST open a nested menu, and no overflow menu MUST exist there; the Previously planned verdict controls of `lead-plan-verdict` keep their own menu. On devices without hover the row MUST be visible at all times. The stage control MUST list only the unit's owned stages, MUST write through the current draft with every other item field preserved, and MUST NOT remove a Product item's last stage. Activity items MUST NOT render a stage control. Operating the status menu or a row control with a keyboard MUST return focus to the triggering control, and the three-column lineage MUST stay visible without document-level horizontal overflow. Updating an unconfirmed carried item through the status menu MUST clear its unconfirmed marker without a separate Confirm action. Previously planned content MUST remain read-only: no control in that column edits, moves or changes the status of the prior-week occurrence; the verdict controls defined by `lead-plan-verdict` write only the selected week's occurrence.

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

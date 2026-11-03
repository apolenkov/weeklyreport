## MODIFIED Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

Editable Lead Overview MUST create Current and Next items in an inline, owner- and week-specific composer, using canonical draft-save, authorization and lifecycle paths. Detailed editing MUST use the canonical item editor. Previously planned and ineligible sections remain read-only.

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead activates Add item within an editable Product's selected week
- **THEN** an inline composer is bound to that Product and week
- **AND** saving uses existing draft patch, autosave, optimistic version, authorization and lifecycle paths
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead activates Add item within an editable Activity's selected week
- **THEN** an inline composer is bound to that Activity with no Product-stage requirement
- **AND** saving uses the canonical draft and autosave path

#### Scenario: An Overview cell is not writable

- **WHEN** a cell is Previously planned or its section is submitted, locked, historical, or foreign
- **THEN** no Add or Edit action is rendered for that cell
- **AND** activating its content cannot emit a draft patch

## REMOVED Requirements

### Requirement: Overview create and edit MUST open in a dialog

**Reason**: The owner requested creation in the Current or Next grid context with inline entry, superseding header-only modal creation. Detailed editing continues to use the canonical dialog.

**Migration**: Replace the unit-header-only create entry with the week-specific inline entry. Preserve canonical modal editing, safe cancellation, failure recovery and the existing separate toolbar flows.

## ADDED Requirements

### Requirement: Overview creation is inline and detailed edit remains modal

Overview MUST offer contextual inline creation in editable Current and Next unit lanes, including empty units. Previously planned MUST offer no creation. Eligible existing items MUST retain the canonical detailed modal editor. Only one item editor may be open, selected by stable identity with physical-ID fallback and source; focus, dismissal, validation and save recovery MUST remain deterministic.

#### Scenario: Create a Current item inline

- **WHEN** a Lead selects Add item in an eligible Product's Current week lane
- **THEN** an inline composer opens with that Product and Current week fixed
- **AND** there is no duplicate Add control on each lineage row or solely on the left unit rail

#### Scenario: A new item is created directly in Next

- **WHEN** a Lead selects Add item in an eligible Activity's Next week lane
- **THEN** the inline composer is bound to that Activity and Next week
- **AND** Planned progress is selected and can be changed before saving
- **AND** saving unchanged defaults emits one Next item with `workflowStatus=planned`

#### Scenario: An item is edited in detail

- **WHEN** the Lead activates Edit details on an eligible Current or Next item
- **THEN** the canonical editor opens in a modal for that item, without moving the timeline grid behind it
- **AND** closing returns focus to the Edit control unless a successful creation moves focus to the new item

#### Scenario: A dirty editor is dismissed

- **WHEN** a dirty inline composer is cancelled or the detailed modal receives Escape, outside click, close button or Cancel
- **THEN** the existing discard and save-recovery protections apply and unsaved input is not silently lost

#### Scenario: Save and add another succeeds

- **WHEN** the Lead enters a valid inline item and activates Save and add another or presses Ctrl+Shift+Enter / Cmd+Shift+Enter
- **THEN** the item is persisted through the canonical draft path and the composer remains for the same owner and week
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
- **THEN** it offers no creation or edit mutation controls

### Requirement: Owned product stages are directly selectable in context

An eligible Lead MUST be able to see and select their product's currently assigned SDLC stages directly in the item creation context and on an editable item, without opening the full details dialog. Selection MUST remain within the author-owned stages and retain existing minimum-stage and lifecycle validation.

#### Scenario: Choose an available stage while creating an item

- **GIVEN** a product has multiple stages currently assigned to the Lead
- **WHEN** the Lead begins creating an item for that product and week
- **THEN** available stages are presented as directly selectable labelled controls
- **AND** choosing one associates that stage with the intended item without opening a separate details editor

#### Scenario: A sole owned stage is unambiguous

- **GIVEN** exactly one eligible stage is assigned to the Lead for the product
- **WHEN** a new item is started in that context
- **THEN** the stage is applied by the established default and remains visible

#### Scenario: A selected stage becomes unavailable

- **WHEN** a previously selected stage is no longer eligible before saving
- **THEN** the selection and user input remain visible with an explanation and an explicit way to remove the stale selection
- **AND** the write is blocked until the choice is valid

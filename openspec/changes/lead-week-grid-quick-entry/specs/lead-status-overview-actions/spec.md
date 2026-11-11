## MODIFIED Requirements

### Requirement: Overview cards MUST expose their actions flat, one click and one menu level

The `/lead/report/:reportId` Report Overview MUST show two temporal columns, This week and Next week, by default. The frozen Previously planned column MUST be available on demand through a "Show last week" control; it is read-only, shows each plan as published with its outcome mark, and has no controls. The show/hide choice MAY be remembered per browser. Each editable Current or Next item MUST rest as one status icon followed by its text and, for Product items, its stage names as muted text on the same line. The status icon MUST open a menu of statuses; when the item can take a terminal outcome, that same menu MUST end with an outcome entry that opens the existing outcome flow, and no separate "Update status" entry MUST exist. The outcome entry MUST follow the existing eligibility: never on Previous rows, an unconfirmed carry, or a derived Next projection. On pointer hover, keyboard focus within the item, or an open control, a row of icon buttons MUST appear without changing the card's layout or the text's width (on hover devices it floats over the card's corner and steps aside while the inline text editor has focus): Edit (pencil), the week move, the record comment action, and the Plan or Restore recovery action where it applies. Hidden controls MUST stay in the accessibility tree and the Tab order. No control on a Current or Next card MUST open a nested menu, and no overflow menu MUST exist there; the Previously planned verdict controls of `lead-plan-verdict` keep their own menu. On devices without hover the row MUST be visible at all times. Activating the stage text of an eligible Product item MUST open, in place, only the Lead's currently owned stages as selectable labels; a sole owned stage stays visible as text. They MUST be keyboard operable, write through the current draft with every other item field preserved, and MUST NOT remove a Product item's last stage. Activity, Previously planned and unowned items MUST NOT render stage mutation controls. Operating the status menu, a stage control or a row control with a keyboard MUST return focus to the triggering control, and the visible temporal columns MUST stay without document-level horizontal overflow. Updating an unconfirmed carried item through the status menu MUST clear its unconfirmed marker without a separate Confirm action. Previously planned content MUST remain read-only: no control in that column edits, moves or changes the status of the prior-week occurrence; the verdict controls defined by `lead-plan-verdict` write only the selected week's occurrence.

#### Scenario: an ordinary active item is shown

- **WHEN** Overview renders an editable Current or Next item with no restore or historical-replan state
- **THEN** it shows the status icon, its text and, for a Product item, its stage names as muted text on the same line
- **AND** no text button and no metadata line is visible until hover or focus

#### Scenario: actions appear on hover without moving the layout

- **WHEN** the lead hovers the item or moves keyboard focus into it
- **THEN** Edit and the week move become visible in one row
- **AND** the card and its neighbours keep their size and position
- **AND** no "More actions" control is rendered

#### Scenario: the status menu holds the outcome

- **GIVEN** an editable Current item that can be resolved
- **WHEN** the lead opens its status menu
- **THEN** the progress statuses and one outcome entry are listed in that single menu
- **AND** choosing the outcome entry opens the existing outcome flow

#### Scenario: the stage label is set on the card

- **GIVEN** an editable Product item
- **WHEN** the lead activates the item's stage text and selects a stage owned by the Lead
- **THEN** the item's stages update through the canonical draft save path with all other fields preserved
- **AND** only currently owned stages are selectable, in place, without opening the details editor

#### Scenario: the last stage cannot be removed

- **GIVEN** an editable Product item with one stage
- **WHEN** the lead attempts to deselect its only stage label
- **THEN** that stage cannot be unchecked and the control says a Product update needs a stage
- **AND** no draft patch is emitted

#### Scenario: an Activity item has no stage control

- **WHEN** Overview renders an editable Activity item
- **THEN** it has no stage control

#### Scenario: keyboard operation preserves context

- **WHEN** the lead operates the status menu, a stage control or a row control with a keyboard, or closes a dialog
- **THEN** focus returns to the triggering item control or the Overview heading
- **AND** the visible temporal columns remain without document-level horizontal overflow

#### Scenario: an unconfirmed carried item is shown

- **WHEN** Overview renders a carried Current item that the lead has not updated in the selected week
- **THEN** its status icon visibly marks it as continued or planned but not updated this week
- **AND** the status menu lets the lead update it without a separate Confirm action

#### Scenario: prior week remains read-only

- **WHEN** the Lead shows last week and Overview renders Previously planned content
- **THEN** no control edits, moves or changes the status of the prior-week occurrence
- **AND** verdict controls, when shown, change only the selected week's occurrence

#### Scenario: touch shows the row without hover

- **WHEN** the Overview renders editable items on a device without hover
- **THEN** each item's action row is visible and every control has a touch-size target

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

- **WHEN** a Lead selects "Add what happened" in an eligible Product's This week cell
- **THEN** an inline one-line composer opens with that Product and Current week fixed
- **AND** Done progress is selected and can be changed before saving
- **AND** there is no duplicate Add control on each lineage row or solely on the left unit rail

#### Scenario: A new item is created directly in Next

- **WHEN** a Lead selects "Plan something" in an eligible Activity's Next week cell
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

- **WHEN** the Lead enters a valid inline item and presses Enter in the one-line composer, activates Save and add another, or presses Ctrl+Shift+Enter / Cmd+Shift+Enter in the detailed editor
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

An eligible Lead MUST see currently owned Product stages as selectable labels in the inline composer and change them on editable items in place, without the full details dialog. Selection MUST respect ownership, minimum-stage and lifecycle validation.

#### Scenario: Choose an available stage while creating an item

- **GIVEN** a product has multiple stages currently assigned to the Lead
- **WHEN** the Lead begins creating an item for that product and week
- **THEN** available stages are presented in the composer as directly selectable labelled controls
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

#### Scenario: Start work directly from an owned stage

- **GIVEN** an eligible owned product stage and an editable Current or Next week context
- **WHEN** the Lead activates that stage's add-work control
- **THEN** the inline item composer opens for that product and week with the selected stage visible and preselected
- **AND** no separate full editor or repeated week selection is required

### Requirement: Overview reads in the Lead's order of work

The Overview MUST show, top to bottom: a one-line summary of what blocks submission, the "Last week's plan" answer list of `lead-plan-verdict`, then the This week / Next week grid by Product and Activity. Week, save state, Submit, column headers and the unit name in view MUST stay visible while scrolling. A blocking item linked from the summary MUST expand its unit and receive focus.

#### Scenario: The Lead sees what blocks submission first

- **WHEN** the report has items that block submission
- **THEN** a one-line summary above the answer list names each blocking item as a link
- **AND** activating a link expands the owning unit and focuses that item

#### Scenario: Typed text blocks submission instead of being lost

- **WHEN** an inline composer or editor holds any unsaved change, including text or stage, or a save is pending, and the Lead activates Submit
- **THEN** submission is blocked, both the top summary and the end-of-form explanation link to the unsaved entry, and the input is kept

#### Scenario: The full explanation stays at the end

- **WHEN** the Lead reaches the end of the report
- **THEN** the submission explanation of `lead-completion-guidance` is shown there in normal flow

#### Scenario: Header and unit stay in view

- **WHEN** the Lead scrolls a long report
- **THEN** week, save state, Submit, column headers and the current unit name remain visible

#### Scenario: Narrow screens use week tabs

- **WHEN** the Overview renders at 375 CSS pixels
- **THEN** the answer list stays above the grid, This week and Next week become tabs, and Last week becomes a third tab only after "Show last week"
- **AND** there is no document-level horizontal overflow and every control has a touch-size target

### Requirement: Overview rows are aligned and quiet

Within a unit row, the unit name and the first line of every cell MUST start at the same vertical position, with no in-cell group headers above the first entry, and entries in a column MUST share one text inset. Colour MUST mark only risk severity and what blocks submission. A unit's risks and decisions MUST appear as a count under the unit name that expands their rows in place.

#### Scenario: Cells in a unit row are aligned

- **WHEN** a unit row renders entries, composers or empty add controls in its cells at 1280 CSS pixels
- **THEN** the first line of each cell and the unit name start within 2 CSS pixels of each other
- **AND** entry text in a column shares one left edge

#### Scenario: An item with several stages

- **WHEN** a Product item has several stages
- **THEN** all its stage names are shown as muted text after the description

#### Scenario: Risks collapse to a count

- **WHEN** a unit has risks or decisions
- **THEN** a count with the highest severity shows under the unit name and expands the rows in place on activation

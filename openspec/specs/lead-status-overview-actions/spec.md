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

The `/lead/report/:reportId` Report Overview MUST keep the three temporal columns and the canonical item editor. Each editable Current or Next item MUST rest as one status icon followed by its text, with at most a small stage badge in a corner; it MUST NOT render permanent text action buttons or a metadata line. The status icon MUST be the one primary progress/status interaction and MUST open a menu of statuses, because a cycling click would pass over statuses that need a reason. Secondary actions (edit details, move between weeks, resolve) MUST be reachable from one overflow control that is revealed on pointer hover, on keyboard focus within the item, and on tap, and MUST stay in the accessibility tree and keyboard order while visually hidden. Week moves MUST use that overflow menu, without a duplicate standalone button. Updating an unconfirmed carried item through the status interaction MUST clear its unconfirmed marker; it MUST NOT require a separate Confirm action. Previously planned content MUST remain read-only: no control in that column edits, moves or changes the status of the prior-week occurrence; the verdict controls defined by `lead-plan-verdict` write only the selected week's occurrence.

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
- **THEN** the overflow control becomes visible and offers the applicable week-move action
- **AND** no duplicate standalone quick week-move button is rendered
- **AND** keyboard users reach the control and menu actions with Tab without a hover
- **AND** touch users get them without any hover requirement

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

## MODIFIED Requirements

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

### Requirement: Lead report MUST expose an addressable compact Overview

The `/lead/report/:reportId` route MUST expose addressable Report and Slides views, defaulting to Report Overview. Report MUST retain canonical document/context controls and one unit-header Add item action per eligible unit. Additional contextual create controls MUST reuse the same handlers, not another persistence path. Removing Edit mode MUST preserve `unified-report-authoring` parity.

#### Scenario: A lead opens a report without a mode

- **WHEN** an authenticated lead opens `/lead/report/:reportId`
- **THEN** Report is selected with the compact Overview projection
- **AND** Slides remains directly reachable without a modal

#### Scenario: A lead opens an explicit edit link

- **WHEN** the route contains `mode=edit`
- **THEN** the route normalizes to the canonical Report URL without writing or duplicating records
- **AND** editable controls, autosave, submit, and completion remain available according to section eligibility

#### Scenario: An editable lead opens the default route

- **WHEN** the lead opens `/lead/report/:reportId` without a mode query
- **THEN** Report retains report identity, autosave, Fill from, Retry after autosave error, Submit, period navigation, visibility, mode controls, and the eligible unit-header Add item action
- **AND** all actions use canonical editor eligibility and handlers

#### Scenario: An Overview action opens a canonical dialog

- **WHEN** the lead activates unit Add item, contextual creation, Fill from, Submit, or reopen/revoke
- **THEN** the existing lead dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

### Requirement: Empty temporal cells MUST state their emptiness in plain language

Status Overview MUST show empty desktop cells as `—` plus sr-only `No item in this period`, with the dash hidden from assistive technology. On mobile, one plain-language line per unit MUST state that other periods are empty, without naming each empty period or repeating dates. Contextual creation for empty editable periods MUST remain reachable under the contextual-create requirement.

#### Scenario: A temporal cell has no content

- **WHEN** a Previously planned, Current week, or Next week desktop cell has no item
- **THEN** it shows `—` visually and `No item in this period` to a screen reader
- **AND** no edit or next-step control exists for an absent item
- **AND** contextual Add is offered only for eligible Current/Next cells; historical and read-only views expose no write controls

#### Scenario: Empty periods are compacted on mobile

- **WHEN** a mobile reporting unit contains empty temporal cells
- **THEN** one plain-language line states that other periods are empty, such as `No items in other periods`
- **AND** individual empty lanes remain collapsed and do not repeat dates or name each empty period
- **AND** Current and Next creation remains touch-reachable from the unit header, including when the whole unit is empty
- **AND** Previously planned remains read-only

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

## REMOVED Requirements

### Requirement: Overview previews MUST separate reading from editing

**Reason**: Its Move-as-continuation scenario contradicts the owner's placement-only decision. Reading/accessibility guarantees are retained in the replacement requirement; Move semantics belong to `record-status-derivation`.

**Migration**: Replace this block, including `a Current result continues next week`, with the reading/secondary-action requirement below and the placement-only move requirement in `record-status-derivation`. This changes no existing continuation/promotion behavior.

## ADDED Requirements

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

### Requirement: Overview previews MUST preserve reading and secondary-action access

Editable Current/Next previews MUST keep readable copy, a separate complete-editor action, a status interaction, and one applicable secondary-action disclosure. Read-only previews MUST expose no write action. Move MUST follow the placement-only contract in `record-status-derivation`, not reinterpret Continue next week.

#### Scenario: the lead reads and edits a long update

- **WHEN** an editable long update is collapsed
- **THEN** its full-text disclosure remains operable and its copy remains readable
- **AND** copy activation opens the editor with accessible name `Edit item: <update text>`
- **AND** its status icon is named `Status of <update text>: <status>`
- **AND** Edit details opens the same editor

#### Scenario: secondary actions share one disclosure

- **WHEN** Edit details, Update status, or an applicable Move action exists
- **THEN** one disclosure named `More actions for <update text>` exposes those actions
- **AND** it is absent when no secondary action applies
- **AND** outcome actions, text disclosure, and focus restoration remain operable

#### Scenario: a Current occurrence is postponed to Next

- **WHEN** the lead selects Move to next week for an eligible Current item without a separate next commitment
- **THEN** the canonical editor selects Next and retains description and progress without writing before Save
- **AND** Save follows the placement-only move contract, not the separate Continue next week verdict

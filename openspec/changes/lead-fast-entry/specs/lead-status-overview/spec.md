## MODIFIED Requirements

### Requirement: Overview MUST edit and create current-period items through the canonical editor

For an editable lead draft on `/lead/report/:reportId`, Current week and Next week items MUST open the existing item editor without leaving Overview. Every editable Current and Next cell MUST also expose a contextual `+` create action seeded to that reporting unit and week; it MUST be visible on pointer hover or keyboard focus within the cell and always visible on touch devices. The unit-header `Add item` action MUST remain available. A new item created directly in Next MUST start with editable progress Planned; this MUST NOT rewrite an existing item's progress when it moves weeks. Saving an edit or creation MUST update the one canonical lead draft and MUST use its existing `DraftPatch`, autosave, optimistic version, authorization, and lifecycle paths. Previously planned MUST remain immutable. Submitted, locked, historical, and foreign records MUST NOT expose an Overview write action.

#### Scenario: A lead creates a Product update from Overview

- **WHEN** the lead activates `+` in an editable Product Current or Next cell
- **THEN** the existing item editor opens on the same page with that Product and week selected
- **AND** saving appends the item through the canonical week-items draft patch
- **AND** the live Overview projection and autosave status reflect the change

#### Scenario: A lead creates an Activity update from Overview

- **WHEN** the lead activates `+` in an editable Activity Current or Next cell
- **THEN** the existing item editor opens with that Activity selected and no Product-stage requirement
- **AND** saving follows the same canonical draft and autosave path

#### Scenario: An Overview cell is not writable

- **WHEN** a cell is Previously planned or its section is submitted, locked, historical, or foreign
- **THEN** no Add or Edit action is rendered for that cell
- **AND** activating its content cannot emit a draft patch

#### Scenario: Contextual creation is reachable without hover

- **WHEN** the lead moves keyboard focus into an editable Current or Next cell, or uses a touch device
- **THEN** its contextual `+` is visible and keyboard/touch operable
- **AND** its accessible name identifies creation, reporting unit, and week
- **AND** a pointer user can reveal the same action by hovering that cell

#### Scenario: A new item is created directly in Next

- **WHEN** the lead activates the Next cell `+`
- **THEN** the composer is seeded to Next and its progress is Planned without a week-switch click
- **AND** the lead can change that progress before saving
- **AND** saving an unchanged default emits a Next item with `workflowStatus=planned`

Code anchors at baseline `99d3651f2`: [unit creation](../../../../../apps/web/src/features/report-sections/ui/status-overview-timeline-footer.tsx#L11-L35), [cell rendering](../../../../../apps/web/src/features/report-sections/ui/status-overview-lineage-row.tsx#L126-L147), [new-item status seed](../../../../../apps/web/src/features/report-sections/ui/item-edit-dialog-helpers.ts#L166-L175). Cell `+` is proposed, not implemented at this baseline.

Unchanged invariants: explicit Next wins W+1 rollover; without it unfinished Current continues; at most one active Next per `stableId`; Previous is read-only; `periodState` and lifecycle tuple remain atomic.

### Requirement: Lead report MUST expose an addressable compact Overview

The `/lead/report/:reportId` route MUST expose `Report` and `Slides` as addressable views. Report MUST use the Overview projection as its unified reading and authoring surface; Slides MUST retain the presentation surface. A lead opening the route without a valid mode MUST see Report. Report MUST retain the canonical report identity, autosave, Fill from, Save, Submit, period navigation, visibility, and mode controls, and each editable reporting unit's single header `Add item` action whenever available for the current section. Contextual Current/Next cell `+` controls supplement that header action; they MUST call the same creation flow. These controls MUST call the existing editor draft and write actions; Overview MUST NOT introduce a second action implementation or persistence path. Removing the separate Edit mode MUST satisfy the full authoring parity requirement in `unified-report-authoring`.

#### Scenario: A lead opens a report without a mode

- **WHEN** an authenticated lead opens `/lead/report/:reportId`
- **THEN** Report is selected with the compact Overview projection
- **AND** Slides remains directly reachable without a modal

#### Scenario: A lead opens an explicit edit link

- **WHEN** the route contains `mode=edit`
- **THEN** the route normalizes to the canonical Report URL
- **AND** the existing editable controls, autosave, submit, and completion flows remain available in Report according to section eligibility
- **AND** normalization does not write or duplicate report records

#### Scenario: An editable lead opens the default route

- **WHEN** the lead opens `/lead/report/:reportId` without a mode query
- **THEN** Report is active and the canonical document/context actions render
- **AND** Save, Submit, period, visibility, and mode actions use the canonical editor eligibility and handlers

#### Scenario: An Overview action opens a canonical dialog

- **WHEN** the lead activates a unit `Add item`, a contextual cell `+`, Fill from, Submit, or reopen/revoke
- **THEN** the existing lead dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

Code anchor at baseline `99d3651f2`: [existing header action](../../../../../apps/web/src/features/report-sections/ui/status-overview-timeline-footer.tsx#L11-L35); the additional entry points reuse it rather than replacing it.

Unchanged invariants: explicit Next wins W+1 rollover; without it unfinished Current continues; at most one active Next per `stableId`; Previous is read-only; `periodState` and lifecycle tuple remain atomic.

### Requirement: Empty temporal cells MUST state their emptiness in plain language

The Lead Report route's Status Overview MUST show an empty desktop temporal cell as a visible `—` with screen-reader text `No item in this period`; the decorative dash MUST be hidden from assistive technology. Editable Current/Next cells MUST allow the contextual creation action above even when empty; Previously planned and read-only cells MUST expose no write control. On smaller screens empty periods MAY be compacted into the unit's plain-language empty-period summary without repeating dates or losing contextual creation access. The unit-header `Add item` action MUST remain hidden for historical units and read-only views.

#### Scenario: A temporal cell has no content

- **WHEN** a Previously planned, Current week, or Next week desktop cell has no item
- **THEN** it shows `—` visually and `No item in this period` to a screen reader
- **AND** it exposes no edit or next-step control for an absent item
- **AND** only an editable Current or Next cell offers contextual creation

#### Scenario: Empty periods are compacted on mobile

- **WHEN** Overview renders below its desktop layout with empty temporal cells
- **THEN** a plain-language summary identifies the empty periods without repeating per-cell dates
- **AND** Current/Next contextual creation remains available on touch
- **AND** Previously planned remains read-only

Code anchor at baseline `99d3651f2`: [existing dash and sr-only copy](../../../../../apps/web/src/features/report-sections/ui/status-overview-lineage-row.tsx#L59-L79), [mobile empty summary](../../../../../apps/web/src/features/report-sections/ui/status-overview-lineage-row.tsx#L150-L156). This reconciles the copy with current code; cell creation is the separate proposed addition.

Unchanged invariants: explicit Next wins W+1 rollover; without it unfinished Current continues; at most one active Next per `stableId`; Previous is read-only; `periodState` and lifecycle tuple remain atomic.

### Requirement: Overview editing MUST preserve context and use the timeline width

The idle Status Overview MUST retain its compact unit and temporal reading grid. When an existing item editor or resolve/restore editor is mounted for one reporting unit, the complete Previous, Current, and Next lineage MUST remain visible and the exact matching editor MUST open below that lineage across the complete timeline width at multi-lane breakpoints. Other lineage rows and reporting units MUST remain rendered. Editor selection MUST continue to use canonical stable identity with the existing record-ID fallback and source boundary. Both header and contextual cell creation MUST use the unit's one composer region, not a composer per entry point. The idle unit MUST NOT render a footer strip whose only content is the add affordance.

#### Scenario: a linked Current item is edited

- **WHEN** the lead activates `Update progress` (or `Edit details` in `More actions`) for a linked Current item
- **THEN** exactly one matching editor spans the three timeline columns below the lineage
- **AND** the Previous, Current, and Next cells remain visible while editing
- **AND** unmatched lineage rows and reporting units remain rendered
- **AND** closing the editor restores the idle cells and returns focus to the same control that opened it

#### Scenario: an independent update is edited

- **WHEN** the lead edits an unlinked Current or Next update
- **THEN** the matching editor spans the timeline below its source row
- **AND** the source context and sibling timeline cells remain visible
- **AND** the update is matched by stable identity or record ID together with its source

#### Scenario: an update is created

- **WHEN** the lead activates the unit `Add item` control (accessible name `Add item to <unit name>`) in the unit header or a contextual Current/Next cell `+`
- **THEN** the create composer spans the timeline in that unit's composer region
- **AND** a cell action seeds its own week while the header action retains its Current default
- **AND** no duplicate composer is mounted
- **AND** closing or acknowledging the create restores the idle composer region

Code anchor at baseline `99d3651f2`: [single create-composer host](../../../../../apps/web/src/features/report-sections/ui/status-overview-timeline-footer.tsx#L39-L53), [editor identity and source](../../../../../apps/web/src/features/report-pages/ui/lead/shell/use-overview-item-editor.tsx#L119-L132).

Unchanged invariants: explicit Next wins W+1 rollover; without it unfinished Current continues; at most one active Next per `stableId`; Previous is read-only; `periodState` and lifecycle tuple remain atomic.

### Requirement: Overview previews MUST separate reading from editing

Editable Current and Next previews MUST render readable update copy and expose a separate action for the complete item editor. In the clickable item preview its accessible name MUST be `Edit item: <update text>`. The status icon's accessible name MUST be `Status of <update text>: <status>`. Read-only copy MUST NOT expose a write action. Existing text disclosure, outcome actions and focus restoration MUST remain operable.

Secondary actions (`Edit details`, `Update status`, and `Move to next week` / `Move to this week`) MUST be reachable through one disclosure (accessible name `More actions for <update text>`); the disclosure MUST NOT render when none of them applies. For an eligible Current occurrence without a separate next commitment, `Move to next week` MUST mean postponing that occurrence from Current to Next, not recording a Current result plus `nextStepText`. It MUST remain distinct from `Continue next week`; existing continuation/promotion handling for an item that already has `nextStepText` is unchanged.

#### Scenario: a Current result continues next week

- **WHEN** the lead activates `Move to next week` in `More actions` for an eligible Current item with no separate next commitment
- **THEN** the canonical editor selects Next and retains the item's description and progress
- **AND** no move is persisted before Save
- **AND** saving moves that occurrence to `type=next`, clears its carried marker, and removes its Current occurrence without creating a duplicate
- **AND** it does not synthesize `nextStepText` or a Current result, and does not set progress to `postponed` merely because the action means postponement

#### Scenario: cancelling a move leaves placement unchanged

- **WHEN** the lead cancels the move editor without saving, following the existing discard rules
- **THEN** the item remains in Current and no move patch is emitted
- **AND** focus returns to the triggering item control

#### Scenario: the lead reads and edits a long update

- **WHEN** an editable long update is collapsed
- **THEN** its copy remains readable with the existing full-text disclosure
- **AND** activating the copy opens the canonical editor
- **AND** activating `Edit details` in `More actions` opens the canonical editor

Code anchors at baseline `99d3651f2`: [placement-only patch and duplicate guard](../../../../../apps/web/src/features/report-sections/model/lead-actions/lead-item-actions.ts#L21-L72), [save applies move](../../../../../apps/web/src/features/report-pages/ui/lead/shell/overview-item-save.ts#L163-L184), [unchanged next-step promotion](../../../../../apps/web/src/features/report-pages/ui/lead/shell/overview-item-save.ts#L287-L300), [existing move regression](../../../../../apps/web/src/features/report-pages/ui/lead/shell/lead-status-overview.test.tsx#L1703-L1744). Move semantics reconcile the spec to code; no new move implementation is authorized here.

Unchanged invariants: explicit Next wins W+1 rollover; without it unfinished Current continues; at most one active Next per `stableId`; Previous is read-only; `periodState` and lifecycle tuple remain atomic.

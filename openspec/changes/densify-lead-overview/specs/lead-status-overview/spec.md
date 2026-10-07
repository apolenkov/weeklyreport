# Spec Delta

## MODIFIED Requirements

### Requirement: Lead report MUST expose an addressable compact Overview

The `/lead/report/:reportId` route MUST expose `Report` and `Slides` as
addressable views. Report MUST use the Overview projection as its unified
reading and authoring surface; Slides MUST retain the presentation surface.
A lead opening the route without a valid mode MUST see Report. Report MUST
retain the canonical report identity, autosave, Fill from, Save, Submit,
period navigation, visibility, and mode controls, and each editable reporting
unit's single `Add item` action in the unit header whenever available
for the current section. These controls MUST call the existing editor draft
and write actions; Overview MUST NOT introduce a second action implementation
or persistence path. Removing the separate Edit mode MUST satisfy the full
authoring parity requirement in `unified-report-authoring`.

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

- **WHEN** the lead activates a unit `Add item`, Fill from, Submit, or reopen/revoke
- **THEN** the existing lead dialog host handles the action
- **AND** no Overview-specific mutation endpoint or draft store is used

### Requirement: Overview editing MUST preserve context and use the timeline width

The idle Status Overview MUST retain its compact unit and temporal reading
grid. When an existing item editor or resolve/restore editor is mounted for one
reporting unit, the complete Previous, Current, and Next lineage MUST remain
visible and the exact matching editor MUST open below that lineage across the
complete timeline width at multi-lane breakpoints. Other lineage rows and
reporting units MUST remain rendered. Editor selection MUST continue to use
canonical stable identity with the existing record-ID fallback and source
boundary. The idle unit MUST NOT render a footer strip whose only content is
the add affordance.

#### Scenario: a linked Current item is edited

- **WHEN** the lead activates `Update progress` (or `Edit details` in `More actions`) for a linked Current item
- **THEN** exactly one matching editor spans the three timeline columns below the lineage
- **AND** the Previous, Current, and Next cells remain visible while editing
- **AND** unmatched lineage rows and reporting units remain rendered
- **AND** closing the editor restores the idle cells and returns focus to the
  same control that opened it

#### Scenario: an independent update is edited

- **WHEN** the lead edits an unlinked Current or Next update
- **THEN** the matching editor spans the timeline below its source row
- **AND** the source context and sibling timeline cells remain visible
- **AND** the update is matched by stable identity or record ID together with
  its source

#### Scenario: an update is created

- **WHEN** the lead activates the unit `Add item` control (accessible name `Add item to <unit name>`) in the unit header
- **THEN** the create composer spans the timeline in that unit's composer region
- **AND** no duplicate composer is mounted
- **AND** closing or acknowledging the create restores the idle composer region

### Requirement: Overview MUST expose one primary progress interaction per active item

The `/lead/report/:reportId` Report Overview MUST keep the three temporal columns and the canonical item editor. Each editable Current or Next item MUST rest as one status icon followed by its text, with at most a small stage badge in a corner; it MUST NOT render permanent text action buttons or a metadata line. The status icon MUST be the one primary progress/status interaction and MUST open a menu of statuses, because a cycling click would pass over statuses that need a reason. Secondary actions (edit details, move between weeks, resolve) MUST be reachable from one overflow control without a separate quick week-move button that is revealed on pointer hover, on keyboard focus within the item, and on tap, and MUST stay in the accessibility tree and keyboard order while visually hidden. Updating an unconfirmed carried item through the status interaction MUST clear its unconfirmed marker; it MUST NOT require a separate Confirm action. Previously planned content MUST remain read-only: no control in that column edits, moves or changes the status of the prior-week occurrence; the verdict controls defined by `lead-plan-verdict` write only the selected week's occurrence.

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

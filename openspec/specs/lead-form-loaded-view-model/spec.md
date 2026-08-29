# lead-form-loaded-view-model Specification

## Purpose

Derive the loaded lead-form view, cross-author visibility, activity alarms, and available affordances through one behavior-compatible view model.

## Requirements

### Requirement: Lead form loaded view model is isolated behind a tested boundary

The lead report form at `/lead/report/[reportId]` MUST keep loaded
presentation derivations for display products, activity cards, item rows, risk
rows, decision rows, periods, lock sets, and read-only affordances behind a
feature-local loaded-view-model boundary. The boundary MUST NOT introduce new
API procedures, schemas, routes, product UI strings, or write endpoints.

#### Scenario: LeadForm delegates loaded display derivations

- **WHEN** the lead report form renders after all required queries have loaded
- **THEN** `LeadForm` obtains display products, own/display record arrays,
  activity cards, period options, lock sets, fill-from lock state, unified
  entries, current user, and read-only state from the loaded-view-model boundary
- **AND** route/query/session/visibility setup remains outside that boundary
- **AND** draft orchestration, write actions, and draft merge commands remain in
  their existing boundaries

### Requirement: Cross-author display gating remains behavior-compatible

The loaded-view-model boundary MUST preserve the current cross-author display
semantics. Foreign full-content item, risk, and decision rows MUST be displayed
only when the record-visibility state is hydrated, the user selected Everyone,
and the slides deck is the user's own deck. Own record arrays used for writes
and submit summaries MUST NOT include foreign rows.

#### Scenario: Everyone shows gated foreign content read-only

- **WHEN** visibility is hydrated, Everyone is selected, and the current deck is
  the lead's own deck
- **THEN** display item, risk, and decision arrays include foreign read-only rows
  from the gated full-content read
- **AND** own item, risk, and decision arrays remain limited to the lead's own
  editable records

#### Scenario: Mine and foreign decks exclude full content rows

- **WHEN** visibility is not hydrated, Mine is selected, or the slides deck is a
  foreign author's deck
- **THEN** display item, risk, and decision arrays contain only the lead's own
  records
- **AND** no foreign full-content row can reach draft/write inputs through the
  loaded view model

### Requirement: Loaded affordance derivations remain behavior-compatible

The loaded-view-model boundary MUST preserve current derived affordances:
priority ranks MUST be computed from own current and next-week items only,
published-lineage lock sets MUST be derived from raw draft stable IDs,
fill-from lock state MUST reflect published item or decision lineage, visible
periods MUST preserve the archived-period filter behavior, and read-only state
MUST remain derived from the mapped read-only flag or submitted state.

#### Scenario: Published-lineage affordances preserve identity

- **WHEN** the loaded section includes published item or decision stable IDs
- **THEN** item and decision lock sets contain the matching current presentation
  row ids
- **AND** fill-from is locked when either published item or decision lineage is
  present

#### Scenario: Archived-period visibility remains stable

- **WHEN** archived periods exist and the archive toggle is off
- **THEN** non-archived periods remain visible
- **AND** the selected archived period remains visible when it is the current
  selected period

### Requirement: Unified activity and activity alarm derivations remain behavior-compatible

The loaded-view-model boundary MUST preserve unified activity and activity alarm
derivations. The unified by-state view MUST be an opt-in presentation controlled
by the organization `AppSettings.unifiedActivityView` flag; the classic
Current/Next layout MUST remain the default when the flag is off. Activity card
alarm floors MUST derive from the live own-risk draft rows. Unified activity
entries for own rows MUST derive a total bucket mapping from raw item workflow
fields: `done` to `done`, `in_progress` to `in-progress`, `paused` to `paused`,
`planned` to `planned-next`, and `postponed` to `deferred`. `carriedOver` MUST
remain provenance only and MUST NOT alter the bucket. Foreign rows MUST derive
buckets from presentation status because their raw draft rows are unavailable.

#### Scenario: The classic layout remains the default

- **WHEN** `AppSettings.unifiedActivityView` is false
- **THEN** the lead form renders the classic Current/Next sections
- **AND** no persisted bucket field is required

#### Scenario: Every workflow status maps to one bucket

- **WHEN** the unified view derives a bucket for an own item
- **THEN** every allowed workflow status maps to its canonical presentation bucket
- **AND** changing only `carriedOver` does not change that bucket

#### Scenario: Unified entries derive buckets from the correct source

- **WHEN** the loaded view model builds unified activity entries
- **THEN** own rows use raw `type`, `workflowStatus`, and `carriedOver` fields
  to derive their bucket
- **AND** foreign rows use their presentation status because no raw draft row is
  available

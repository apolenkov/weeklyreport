## ADDED Requirements

### Requirement: Lead form draft merges are isolated behind a tested boundary

The lead report form at `/lead/report/[reportId]` MUST keep presentation-to-draft
edit commands for product status, activity status, items, risks, decisions, item
move actions, blocker routing, and quick-add item saves behind a feature-local
draft-merge boundary. The boundary MUST NOT introduce new API procedures,
schemas, routes, product UI strings, or write endpoints.

#### Scenario: LeadForm delegates draft edit commands

- **WHEN** the lead report form renders after the extraction
- **THEN** `LeadForm` obtains product, activity, item, risk, decision,
  move-action, blocker-routing, and quick-add handlers from the draft-merge
  boundary
- **AND** route/query/session/visibility setup remains outside that boundary
- **AND** submit/revoke/reopen/fill-from write actions remain in the existing
  write-action hook

### Requirement: Draft merge semantics remain behavior-compatible

The draft-merge boundary MUST preserve the current raw draft invariants when
child presentation components emit changes. Activity-parented records MUST
preserve `activityId`, clear product/stage parent fields, and satisfy the
existing product/activity XOR shape. Product-parented records MUST preserve
product and stage fields while clearing `activityId`. Foreign read-only rows
MUST NOT be merged into `draftSection`.

#### Scenario: Activity-parented records keep their parent

- **WHEN** an activity-parented item, risk, or decision is edited through the
  lead form
- **THEN** the resulting draft row keeps the same `activityId`
- **AND** clears the product/stage parent fields used only by product-parented
  rows

#### Scenario: Foreign rows are excluded from autosave draft

- **WHEN** item, risk, or decision change handlers receive rows marked
  `foreign: true`
- **THEN** those rows are excluded from the next `draftSection`
- **AND** autosave can only serialize the lead's own editable records

### Requirement: Item command semantics preserve record identity

The draft-merge boundary MUST preserve current item command behavior. Move,
complete, and pause commands MUST patch the existing draft row by id instead of
deleting/recreating it. Item status conversion MUST preserve priority rank and
MUST clear paused reason whenever a row leaves the paused workflow state.

#### Scenario: Move actions patch the existing row

- **WHEN** a lead moves an item between current and next week
- **THEN** the draft keeps the existing item identity fields
- **AND** only the workflow fields required for the move are changed

#### Scenario: Paused reason clears when item is no longer paused

- **WHEN** a paused item is saved with a non-paused status
- **THEN** the draft row's paused reason is cleared
- **AND** the item priority rank remains unchanged unless the edit explicitly
  changes it

### Requirement: Quick-add and blocker routing remain behavior-compatible

The draft-merge boundary MUST preserve the current quick-add behavior. Risk and
decision quick-add commands MUST trigger the existing section dialogs. Blocker
quick-add and activity alarm raises MUST route through risk creation prefilled
with the requested severity and parent. Current/next item quick-add commands
MUST continue to use the existing item dialog host and merge the saved item into
the matching displayed week.

#### Scenario: Blocker quick-add opens a risk prefill

- **WHEN** a lead chooses the Blocker quick-add action
- **THEN** the lead form opens the existing risk creation flow
- **AND** the prefill severity is `blocked`
- **AND** no free blocked item status is persisted

#### Scenario: Quick-add item saves into the selected week

- **WHEN** a lead saves a quick-add current-week or next-week item
- **THEN** the item is merged through the same draft item merge path as section
  edits
- **AND** the quick-add dialog host closes

## ADDED Requirements

### Requirement: Overview editing MUST preserve context and use the timeline width

The idle Status Overview MUST retain its compact unit and temporal reading
grid. When an existing item editor, create composer, or resolve/restore editor
is mounted for one reporting unit, only the exact matching unit, source, and
record lane MUST expand across the complete timeline width at multi-lane
breakpoints. Sibling lanes in that matched container MUST be temporarily hidden
and MUST return when the editor closes. Other lineage rows and reporting units
MUST remain rendered. Editor selection MUST continue to use canonical stable
identity with the existing record-ID fallback and source boundary.

#### Scenario: a linked Current item is edited

- **WHEN** the lead activates `Edit` for a linked Current item
- **THEN** exactly one matching editor spans the three timeline columns
- **AND** the Previous and Next cells in that lineage row are temporarily hidden
- **AND** unmatched lineage rows and reporting units remain rendered
- **AND** closing the editor restores the idle cells and returns focus to the
  same explicit `Edit` action

#### Scenario: an independent update is edited

- **WHEN** the lead edits an unlinked Current or Next update
- **THEN** only the matching independent list spans the timeline
- **AND** the placeholder and sibling independent list are temporarily hidden
- **AND** the update is matched by stable identity or record ID together with
  its source

#### Scenario: an update is created

- **WHEN** the lead activates `Add current update` or `Plan next week`
- **THEN** the create composer spans the timeline in that unit's footer
- **AND** no duplicate composer is mounted
- **AND** closing or acknowledging the create restores the idle footer

### Requirement: Overview previews MUST separate reading from editing

Editable Current and Next previews MUST render their update copy as readable
text and expose a separate visible action whose accessible name remains
`Edit <update text>`. Activating the text MUST NOT begin editing. Existing text
disclosure, metadata, outcome actions, focus restoration attributes, and
read-only behavior MUST remain operable.

#### Scenario: the lead reads and edits a long update

- **WHEN** an editable long update is collapsed
- **THEN** its copy is ordinary text with the existing full-text disclosure
- **AND** activating the copy does not open an editor
- **AND** activating its visible `Edit` action opens the canonical editor

### Requirement: Independent updates MUST declare their source without invented lineage

Every non-empty independent Current list MUST show
`Current updates without a prior plan`, and every non-empty independent Next
list MUST show `Next updates without a prior plan`. The lists MUST remain
separate source collections and MUST NOT be paired by index or visually align
actions as if the items shared lineage.

#### Scenario: Current and Next contain different independent updates

- **WHEN** both independent lists render
- **THEN** each list has its own visible source label
- **AND** every item remains in its original source list and independent flow

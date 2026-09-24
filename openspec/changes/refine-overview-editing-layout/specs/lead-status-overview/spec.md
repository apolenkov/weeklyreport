## ADDED Requirements

### Requirement: Overview editing MUST preserve context and use the timeline width

The idle Status Overview MUST retain its compact unit and temporal reading
grid. When an existing item editor or resolve/restore editor is mounted for one
reporting unit, the complete Previous, Current, and Next lineage MUST remain
visible and the exact matching editor MUST open below that lineage across the
complete timeline width at multi-lane breakpoints. Other lineage rows and
reporting units MUST remain rendered. Editor selection MUST continue to use
canonical stable identity with the existing record-ID fallback and source
boundary.

#### Scenario: a linked Current item is edited

- **WHEN** the lead activates `Edit` for a linked Current item
- **THEN** exactly one matching editor spans the three timeline columns below the lineage
- **AND** the Previous, Current, and Next cells remain visible while editing
- **AND** unmatched lineage rows and reporting units remain rendered
- **AND** closing the editor restores the idle cells and returns focus to the
  same explicit `Edit` action

#### Scenario: an independent update is edited

- **WHEN** the lead edits an unlinked Current or Next update
- **THEN** the matching editor spans the timeline below its source row
- **AND** the source context and sibling timeline cells remain visible
- **AND** the update is matched by stable identity or record ID together with
  its source

#### Scenario: an update is created

- **WHEN** the lead activates `Add current update` or `Plan next week`
- **THEN** the create composer spans the timeline in that unit's footer
- **AND** no duplicate composer is mounted
- **AND** closing or acknowledging the create restores the idle footer

### Requirement: Overview previews MUST separate reading from editing

Editable Current and Next previews MUST render readable update copy and expose
a separate action for the complete item editor. In the overview action row its
accessible name MUST be `Edit update: <update text>`; in the clickable item
preview its accessible name MUST be `Edit item: <update text>`. Read-only copy
MUST NOT expose a write action. Existing text disclosure, metadata, outcome
actions and focus restoration MUST remain operable.

Primary move and status actions MUST be direct visible controls when available;
the UI MUST NOT require opening a menu that contains only one applicable action.
Moving a Current result to Next MUST keep the Current result and record the
continuation in `nextStepText`, so both weeks remain visible in one lineage.

#### Scenario: a Current result continues next week

- **WHEN** the lead activates the direct Next week action for a Current result
- **THEN** the editor keeps the item in Current and focuses its Next step
- **AND** saving preserves the Current result and stores the continuation for Next

#### Scenario: the lead reads and edits a long update

- **WHEN** an editable long update is collapsed
- **THEN** its copy remains readable with the existing full-text disclosure
- **AND** activating the copy opens the canonical editor
- **AND** activating its visible `Edit` action opens the canonical editor

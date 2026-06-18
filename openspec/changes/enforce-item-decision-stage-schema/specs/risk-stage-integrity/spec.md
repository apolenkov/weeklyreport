## MODIFIED Requirements

### Requirement: A risk always carries at least one concrete SDLC stage

A risk, item, and decision MUST each reference at least one concrete SDLC stage at
every layer: the edit dialog blocks saving a stage-less row, the shared write
schemas (`riskInputSchema`, `itemInputSchema`, `decisionInputSchema`) reject an
empty or absent `stageIds` array via `requiredStageIdsField`, and seed data writes
explicit stages on every seeded risk, item, and decision. The empty-selection
"applies to all assigned stages" fallback is removed at the schema layer for items
and decisions; "all stages" is expressed by selecting every owned stage.

#### Scenario: saving a risk without a stage in the dialog

- **WHEN** the lead fills the risk text, impact, and mitigation but
  selects no stage and exactly one stage is not auto-applicable
- **THEN** saving is blocked with "Select at least one stage."

#### Scenario: the API receives a risk without stages

- **WHEN** a draft-save payload contains a risk whose `stageIds` is
  missing or empty
- **THEN** validation fails and the payload is rejected

#### Scenario: the API receives an item without stages

- **WHEN** a draft-save or submit payload contains an item whose `stageIds`
  is missing or empty
- **THEN** validation fails and the payload is rejected by `itemInputSchema`

#### Scenario: the API receives a decision without stages

- **WHEN** a draft-save or submit payload contains a decision whose `stageIds`
  is missing or empty
- **THEN** validation fails and the payload is rejected by `decisionInputSchema`

### Requirement: Stage-less legacy rows are loud, never disguised

A stage-less risk, item, or decision row MUST render an explicit "No stage set"
warning marker using existing warning tokens. The silent "All stages" /
"all stages" label MUST NOT be used for any of these rows.

#### Scenario: a legacy risk row with no stage data renders

- **WHEN** a risk card renders for a row with empty `stageIds`
- **THEN** the card shows the "No stage set" warning marker
- **AND** no "All stages" label appears

#### Scenario: a legacy item row with no stage data renders

- **WHEN** an item card renders for a row with empty `stageIds`
- **THEN** the card shows the "No stage set" warning marker
- **AND** no "All stages" label appears

#### Scenario: a legacy decision row with no stage data renders

- **WHEN** a decision row renders for a row with empty `stageIds`
- **THEN** the row shows the "No stage set" warning marker
- **AND** no "all stages" label appears

### Requirement: Stage-less rows stay representable until repaired

A stage-less risk, item, or decision row MUST remain loadable and renderable: the
read model tolerates empty `stageIds` via dedicated read-model schemas
(`riskReadModelSchema`, `itemReadModelSchema`, `decisionReadModelSchema`), while
its resave MUST be rejected by the tightened write schema until the lead assigns a
stage in the edit dialog. No backfill exists or is needed: the schema has no legacy
`stageName` column, and verified data holds zero stage-less rows.

#### Scenario: a stage-less risk row is resaved without repair

- **WHEN** the lead saves a draft containing a risk whose `stageIds`
  is still empty
- **THEN** server-side validation rejects the payload loudly
- **AND** the row stays visible with its warning marker until a stage
  is selected in the edit dialog

#### Scenario: a stage-less item or decision row loads then is resaved without repair

- **WHEN** the section read model parses a stored item or decision whose
  `stageIds` is empty
- **THEN** the row loads and renders its "No stage set" marker
- **AND** resaving that same row via the write schema is rejected until a stage
  is selected in the edit dialog

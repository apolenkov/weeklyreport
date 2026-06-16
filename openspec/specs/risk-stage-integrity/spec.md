## Requirements

### Requirement: A risk always carries at least one concrete SDLC stage

A risk entry MUST reference at least one concrete SDLC stage at every
layer: the edit dialog blocks saving a stage-less risk, the shared
write schema (`riskInputSchema`) rejects an empty or absent `stageIds`
array, and seed data writes explicit `stageIds` on every seeded risk.
Items and decisions are exempt — their empty selection keeps its
"all assigned stages" semantics.

#### Scenario: saving a risk without a stage in the dialog

- **WHEN** the lead fills the risk text, impact, and mitigation but
  selects no stage and exactly one stage is not auto-applicable
- **THEN** saving is blocked with "Select at least one stage."

#### Scenario: the API receives a risk without stages

- **WHEN** a draft-save payload contains a risk whose `stageIds` is
  missing or empty
- **THEN** validation fails and the payload is rejected

### Requirement: Stage-less legacy rows are loud, never disguised

A stage-less risk row MUST render an explicit "No stage set" warning
marker using existing warning tokens. The silent "All stages" label
MUST NOT be used for risks.

#### Scenario: a legacy risk row with no stage data renders

- **WHEN** a risk card renders for a row with empty `stageIds`
- **THEN** the card shows the "No stage set" warning marker
- **AND** no "All stages" label appears

### Requirement: Stage-less rows stay representable until repaired

A stage-less risk row MUST remain loadable and renderable (the read
model tolerates empty `stageIds`), and its resave MUST be rejected by
the tightened write schema until the lead assigns a stage in the edit
dialog. No backfill exists or is needed: the schema has no legacy
`stageName` column, and verified data holds zero stage-less rows.

#### Scenario: a stage-less risk row is resaved without repair

- **WHEN** the lead saves a draft containing a risk whose `stageIds`
  is still empty
- **THEN** server-side validation rejects the payload loudly
- **AND** the row stays visible with its warning marker until a stage
  is selected in the edit dialog

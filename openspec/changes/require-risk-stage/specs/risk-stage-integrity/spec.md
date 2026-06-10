## ADDED Requirements

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

A risk row that still has no stages after the legacy `stageName`
fallback MUST render an explicit "No stage set" warning marker using
existing warning tokens. The silent "All stages" label MUST NOT be
used for risks.

#### Scenario: a legacy risk row with no stage data renders

- **WHEN** a risk card renders for a row with empty `stageIds` and no
  legacy `stageName`
- **THEN** the card shows the "No stage set" warning marker
- **AND** no "All stages" label appears

### Requirement: Legacy stage names are backfilled into stage ids

Rows whose stages exist only in the deprecated `stageName` column MUST
be backfilled to `stageIds` via the canonical `splitStageNames`
mapping before the tightened schema can reject their resave.

#### Scenario: an old draft with a stageName-only risk is resaved

- **WHEN** the lead edits and saves a draft whose risk was seeded with
  only the legacy `stageName`
- **THEN** the save succeeds because `stageIds` was backfilled

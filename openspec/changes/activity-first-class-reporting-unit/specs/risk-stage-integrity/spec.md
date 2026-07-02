# risk-stage-integrity — delta: activity-first-class-reporting-unit

## MODIFIED Requirements

### Requirement: A risk always carries at least one concrete SDLC stage

A PRODUCT-parented risk, item, and decision MUST each reference at least one
concrete SDLC stage at every layer: the edit dialog blocks saving a stage-less
row, the shared write schemas (`riskInputSchema`, `itemInputSchema`,
`decisionInputSchema`) reject an empty or absent `stageIds` array via
`requiredStageIdsField`, and seed data writes explicit stages on every seeded
product-parented risk, item, and decision. The empty-selection "applies to all
assigned stages" fallback is removed at the schema layer for items and
decisions; "all stages" is expressed by selecting every owned stage.

This rule applies ONLY to a record whose parent is a PRODUCT. A record parented
to a project ACTIVITY carries no SDLC stage (an activity has no stage lane), so
the write schemas MUST accept an activity-parented risk, item, or decision with
an empty or absent `stageIds`, and the stage-required rule MUST NOT be applied to
it. The parent XOR is what discriminates: a product FK present means the stage
rule applies; an `activityId` present means it does not.

#### Scenario: saving a risk without a stage in the dialog

- **WHEN** the lead fills the risk text, impact, and mitigation but
  selects no stage and exactly one stage is not auto-applicable
- **THEN** saving is blocked with "Select at least one stage."

#### Scenario: the API receives a risk without stages

- **WHEN** a draft-save payload contains a PRODUCT-parented risk whose `stageIds`
  is missing or empty
- **THEN** validation fails and the payload is rejected

#### Scenario: the API receives an item without stages

- **WHEN** a draft-save or submit payload contains a PRODUCT-parented item whose
  `stageIds` is missing or empty
- **THEN** validation fails and the payload is rejected by `itemInputSchema`

#### Scenario: the API receives a decision without stages

- **WHEN** a draft-save or submit payload contains a PRODUCT-parented decision
  whose `stageIds` is missing or empty
- **THEN** validation fails and the payload is rejected by `decisionInputSchema`

#### Scenario: an activity-parented record is accepted without stages

- **WHEN** a draft-save or submit payload contains a risk, item, or decision
  whose parent is an activity (`activityId` set, product FK null) and whose
  `stageIds` is empty or absent
- **THEN** validation ACCEPTS the record — the stage-required rule does not apply
  to an activity parent

### Requirement: Stage-less legacy rows are loud, never disguised

A PRODUCT-parented stage-less risk, item, or decision row MUST render an explicit
"No stage set" warning marker using existing warning tokens. The silent
"All stages" / "all stages" label MUST NOT be used for any of these rows.

The "No stage set" marker signals a PRODUCT-parented row that still needs a stage
assigned. It MUST NOT be shown on an ACTIVITY-parented record: an activity record
legitimately carries no stage, so its stage-less state is expected, not a
repair-needed defect, and it renders with no stage marker at all.

#### Scenario: a legacy risk row with no stage data renders

- **WHEN** a PRODUCT-parented risk card renders for a row with empty `stageIds`
- **THEN** the card shows the "No stage set" warning marker
- **AND** no "All stages" label appears

#### Scenario: a legacy item row with no stage data renders

- **WHEN** a PRODUCT-parented item card renders for a row with empty `stageIds`
- **THEN** the card shows the "No stage set" warning marker
- **AND** no "All stages" label appears

#### Scenario: a legacy decision row with no stage data renders

- **WHEN** a PRODUCT-parented decision row renders for a row with empty `stageIds`
- **THEN** the row shows the "No stage set" warning marker
- **AND** no "all stages" label appears

#### Scenario: an activity record shows no stage marker

- **WHEN** an ACTIVITY-parented item, risk, or decision renders
- **THEN** no "No stage set" warning marker is shown — the absence of a stage is
  expected for an activity record

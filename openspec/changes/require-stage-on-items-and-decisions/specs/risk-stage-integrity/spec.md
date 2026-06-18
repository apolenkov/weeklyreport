## MODIFIED Requirements

### Requirement: A risk always carries at least one concrete SDLC stage

A risk entry MUST reference at least one concrete SDLC stage at every
layer: the edit dialog blocks saving a stage-less risk, the shared
write schema (`riskInputSchema`) rejects an empty or absent `stageIds`
array, and seed data writes explicit `stageIds` on every seeded risk.
Items and decisions are no longer exempt at the dialog layer — see "Items
and decisions require a concrete stage in the edit dialog". (Schema-level
enforcement for items and decisions is a tracked follow-up.)

#### Scenario: saving a risk without a stage in the dialog

- **WHEN** the lead fills the risk text, impact, and mitigation but
  selects no stage and exactly one stage is not auto-applicable
- **THEN** saving is blocked with "Select at least one stage."

#### Scenario: the API receives a risk without stages

- **WHEN** a draft-save payload contains a risk whose `stageIds` is
  missing or empty
- **THEN** validation fails and the payload is rejected

## ADDED Requirements

### Requirement: Items and decisions require a concrete stage in the edit dialog

An item or decision MUST reference at least one concrete SDLC stage when saved through its edit dialog and the chosen product has at least one owned stage: the dialog auto-applies a single owned stage and otherwise blocks saving a stage-less row, exactly as the risk dialog does. The empty-selection "applies to all assigned stages" fallback is removed for items and decisions; "all stages" is expressed by selecting every owned stage.

1. When the selected product has exactly one owned stage, the dialog MUST
   treat it as implicitly selected so the lead can save without a manual click.
2. When the selected product has two or more owned stages and none is selected,
   the dialog MUST block saving with "Select at least one stage."
3. When the selected product has no owned stages (a legacy cross-product row),
   the dialog MUST NOT force a stage — there is none to pick.
4. The `StageMultiSelect` helper copy MUST NOT advertise the empty selection as
   "apply to all assigned stages" when the host dialog requires a stage.

#### Scenario: saving an item without a stage on a multi-stage product

- **WHEN** the lead adds an item to a product where they own two or more stages
  and selects none
- **THEN** saving is blocked with "Select at least one stage."

#### Scenario: saving a decision on a single-owned-stage product

- **WHEN** the lead adds a decision and the product has exactly one owned stage
- **THEN** that stage is applied automatically and the decision saves with it

#### Scenario: the helper copy reflects the required rule

- **WHEN** the item or decision dialog renders its stage selector
- **THEN** the helper text does not say the selection is optional or that an
  empty selection applies to all assigned stages

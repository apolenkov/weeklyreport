## Purpose

A risk (and the escalation rows derived from it) must always carry its concrete
SDLC stage(s) so the report surfaces can resolve and display the stage instead
of a silent placeholder.

## Requirements

### Requirement: A risk always carries at least one concrete SDLC stage

A PRODUCT-parented risk, item, and decision MUST each reference at least one
concrete SDLC stage at every layer: the edit dialog blocks saving a stage-less
row, the shared write schemas (`riskWriteSchema`, `itemWriteSchema`,
`decisionWriteSchema`) enforce the product/activity stage rule through
`writeStageNamesField` and parent-aware superRefine checks, and seed data writes explicit stages on every seeded
product-parented risk, item, and decision. Empty selection MUST NOT mean
"applies to all assigned stages" for items or decisions; "all stages" is
expressed by selecting every owned stage.

This rule applies ONLY to a record whose parent is a PRODUCT. A record parented
to a project ACTIVITY carries no SDLC stage (an activity has no stage lane), so
the write schemas MUST accept an activity-parented risk, item, or decision with
an empty or absent `stageNames`, and the stage-required rule MUST NOT be applied to
it. The parent XOR is what discriminates: a product FK present means the stage
rule applies; an `activityId` present means it does not.

An activity-parented record carrying NO stage is not merely tolerated, it is
REQUIRED: the write schemas MUST REJECT a risk, item, or decision whose
`activityId` is set and whose `stageNames` is NON-empty. An activity owns no
stages, so a stage name on an activity-parented row can only be a spoofed or
stale owned-stage name and MUST fail validation. The `.superRefine` enforces
both directions: stage-required for a product parent, stage-forbidden for an
activity parent.

#### Scenario: saving a risk without a stage in the dialog

- **WHEN** the lead fills the risk text, impact, and mitigation but
  selects no stage and exactly one stage is not auto-applicable
- **THEN** saving is blocked with "Select at least one stage."

#### Scenario: the API receives a risk without stages

- **WHEN** a draft-save payload contains a PRODUCT-parented risk whose `stageNames`
  is missing or empty
- **THEN** validation fails and the payload is rejected

#### Scenario: the API receives an item without stages

- **WHEN** a draft-save or submit payload contains a PRODUCT-parented item whose
  `stageNames` is missing or empty
- **THEN** validation fails and the payload is rejected by `itemWriteSchema`

#### Scenario: the API receives a decision without stages

- **WHEN** a draft-save or submit payload contains a PRODUCT-parented decision
  whose `stageNames` is missing or empty
- **THEN** validation fails and the payload is rejected by `decisionWriteSchema`

#### Scenario: an activity-parented record is accepted without stages

- **WHEN** a draft-save or submit payload contains a risk, item, or decision
  whose parent is an activity (`activityId` set, product FK null) and whose
  `stageNames` is empty or absent
- **THEN** validation ACCEPTS the record — the stage-required rule does not apply
  to an activity parent

#### Scenario: an activity-parented record with a stage is rejected

- **WHEN** a draft-save or submit payload contains a risk, item, or decision
  whose parent is an activity (`activityId` set, product FK null) and whose
  `stageNames` is NON-empty
- **THEN** validation REJECTS the record — an activity owns no stage, so a
  stage-bearing activity row is not allowed

### Requirement: Items and decisions require a concrete stage in the edit dialog

An item or decision MUST reference at least one concrete SDLC stage when saved
through its edit dialog and the chosen product has at least one owned stage: the
dialog auto-applies a single owned stage and otherwise blocks saving a
stage-less row, exactly as the risk dialog does. Empty selection MUST NOT mean
"applies to all assigned stages" for items or decisions; "all stages" is
expressed by selecting every owned stage.

1. When the selected product has exactly one owned stage, the dialog MUST
   treat it as implicitly selected so the lead can save without a manual click.
2. When the selected product has two or more owned stages and none is selected,
   the dialog MUST block saving with "Select at least one stage."
3. When the selected product has no owned stages, the dialog MUST NOT force a
   stage — there is none to pick.
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

### Requirement: Record dialogs do not pre-select stages on create

The Item, Risk, and Decision dialogs MUST open in create mode with NO SDLC stage
pre-selected, so the lead makes an explicit stage choice and cannot silently
skip it.

1. On create, the stage selector MUST start empty for all three dialogs.
2. On edit, the dialog MUST restore the record's existing `stageNames`.
3. The required-stage rule is unchanged: a product with exactly one owned stage
   auto-applies it; a multi-owned-stage product with no selection blocks saving
   with "Select at least one stage."
4. The selector stays multi-select; this requirement removes only the default
   pre-selection, not the ability to pick more than one stage.

#### Scenario: opening Add Item shows no stage checked

- **WHEN** a lead opens the Add Item dialog on a product where they own two or more
  stages
- **THEN** no stage is pre-selected
- **AND** saving without choosing a stage is blocked with "Select at least one stage."

#### Scenario: opening Add Decision shows no stage checked

- **WHEN** a lead opens the Add Decision dialog on a product with two or more owned
  stages
- **THEN** no stage is pre-selected

#### Scenario: editing restores the saved stages

- **WHEN** a lead opens an existing item or decision in edit mode
- **THEN** the stages stored on that record are shown selected

### Requirement: Decision stage options follow the selected product

The Decision dialog MUST source its SDLC stage options from the SELECTED
product's owned stages and reset the selection when the product changes,
exactly as the item and risk dialogs do.

1. The stage options shown MUST be the owned stages of the currently selected
   product, not the union across all products.
2. Changing the product MUST re-scope the stage options to the new product and
   clear the prior selection.

#### Scenario: changing the product re-scopes decision stages

- **WHEN** a lead changes the Product picker in the Add Decision dialog
- **THEN** the stage options update to the newly selected product's owned stages
- **AND** the previous stage selection is cleared

### Requirement: Item and risk stage errors follow the current parent

Changing the parent in an item or risk editor MUST clear the stage-validation
error produced for the previous parent and reset its selected stages. It MUST
preserve unrelated prose errors and unsaved text. The next save MUST validate
the currently selected parent under the existing product/activity rules.

#### Scenario: A single-stage product replaces a failed multi-stage selection

- **WHEN** an item or risk save fails because no stage was selected for a
  multi-stage product and the user switches to a single-stage product
- **THEN** the old stage error disappears and the new stage is applied automatically
- **AND** saving valid prose emits the new product and its single stage

#### Scenario: Parent changes preserve unrelated validation

- **WHEN** an item or risk has both prose and stage errors and its parent changes
- **THEN** only the previous parent's stage error is cleared
- **AND** unrelated prose errors remain until their fields are corrected

#### Scenario: Returning to a multi-stage product validates its new selection

- **WHEN** the user switches back to a multi-stage product and saves without
  selecting a stage
- **THEN** saving is rejected with the current missing-stage error

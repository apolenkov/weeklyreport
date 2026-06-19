## Purpose

A risk (and the escalation rows derived from it) must always carry its concrete
SDLC stage(s) so the report surfaces can resolve and display the stage instead of
a silent placeholder, and so stage-less legacy rows are handled explicitly.

## Requirements

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

### Requirement: Record dialogs do not pre-select stages on create

The Item, Risk, and Decision dialogs MUST open in create mode with NO SDLC stage pre-selected, so the lead makes an explicit stage choice and cannot silently skip it. This propagates the risk dialog's existing behaviour (the `fix-report-surface-integrity` W11 removal of the "all owned stages" default) to the item and decision dialogs.

1. On create, the stage selector MUST start empty for all three dialogs; the prior
   "pre-select every owned stage" default for items and decisions is removed.
2. On edit, the dialog MUST restore the record's existing `stageIds`.
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

The Decision dialog MUST source its SDLC stage options from the SELECTED product's owned stages and reset the selection when the product changes, exactly as the item and risk dialogs do. The earlier department-wide union sourcing is removed.

1. The stage options shown MUST be the owned stages of the currently selected
   product, not the union across all products.
2. Changing the product MUST re-scope the stage options to the new product and
   clear the prior selection.

#### Scenario: changing the product re-scopes decision stages

- **WHEN** a lead changes the Product picker in the Add Decision dialog
- **THEN** the stage options update to the newly selected product's owned stages
- **AND** the previous stage selection is cleared

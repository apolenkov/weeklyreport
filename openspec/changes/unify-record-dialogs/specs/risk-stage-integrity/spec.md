## ADDED Requirements

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

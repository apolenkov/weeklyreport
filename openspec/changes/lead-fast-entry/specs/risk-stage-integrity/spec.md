## REMOVED Requirements

### Requirement: Record dialogs do not pre-select stages on create

**Reason**: Unconditional empty-on-create conflicts with the owner's editable draft-default decision.

**Migration**: Replace it with the editable draft-stage default below. Its no-memory scenarios preserve empty selection; edit restoration, multi-select, ownership, and required-stage validation remain unchanged.

## ADDED Requirements

### Requirement: Record creation MUST use an editable Product-stage default from this draft

Lead Report Item, Risk, and Decision creation MUST pre-select the last saved eligible singleton stage for that Product in this draft. Only a successful Save of exactly one stage advances it; Cancel, a failed Save, or a deliberate multi-select leaves the previous default. The memory MUST survive an editor remount and MUST end on reload or a draft or report change. The default MUST be editable, MUST never select all owned stages, and MUST yield to explicit prefill and stored edit stages.

#### Scenario: opening Add item uses a known stage for this Product and draft

- **GIVEN** the draft's remembered stage for a multi-stage Product is Development
- **WHEN** the lead opens Add item for that Product
- **THEN** Development alone is visibly selected
- **AND** the lead can change or remove it before Save
- **AND** assigning the Product does not select its other stages

#### Scenario: opening Add item shows no stage checked

- **WHEN** Add item opens for a multi-stage Product without a remembered stage or explicit prefill
- **THEN** no stage is selected
- **AND** saving without a stage is blocked with `Select at least one stage.`

#### Scenario: opening Add decision shows no stage checked

- **WHEN** Add decision opens for a multi-stage Product without a remembered stage or explicit prefill
- **THEN** no stage is selected and a stage-less save is blocked

#### Scenario: editing restores the saved stages

- **WHEN** an existing Item, Risk, or Decision opens in edit mode
- **THEN** its saved stages are restored without substitution by a draft default
- **AND** the selector remains multi-select

#### Scenario: risk creation uses the same editable draft default

- **WHEN** Add risk opens without an explicit prefill and this Product has a remembered stage in this draft
- **THEN** only that stage is selected and the lead can revise it
- **AND** several stages may be selected deliberately, never merely because they are assigned

#### Scenario: a single owned stage still needs no extra click

- **WHEN** record creation selects a Product with exactly one owned stage
- **THEN** that stage auto-applies visibly without another click

#### Scenario: a default is cleared rather than treated as all stages

- **WHEN** the lead clears the default on a multi-stage Product and saves without another selection
- **THEN** saving is blocked with `Select at least one stage.`
- **AND** emptiness is not expanded to all stages

#### Scenario: a successful save advances the remembered stage

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead saves an Item, Risk, or Decision for that Product with Testing as its only stage and the save succeeds
- **THEN** Testing becomes the remembered stage for that Product in this draft
- **AND** the next create without explicit prefill pre-selects Testing alone

#### Scenario: Cancel keeps the previous default

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead changes the stage to Testing in an open editor and cancels without saving
- **THEN** Development remains the remembered stage
- **AND** the next create without explicit prefill still pre-selects Development alone

#### Scenario: a failed save keeps the previous default

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead changes the stage to Testing and the Save is rejected by validation or fails to persist
- **THEN** Development remains the remembered stage
- **AND** the next create without explicit prefill still pre-selects Development alone

#### Scenario: a multi-stage save keeps the previous singleton

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead saves the record with a deliberate multi-select of Development and Testing
- **THEN** the saved record stores both stages
- **AND** Development remains the remembered stage and the next create pre-selects it alone
- **AND** neither the multi-select nor an all-stage selection becomes a default
- **AND** the saved array order does not make either stage a default

#### Scenario: a multi-stage save does not invent a default

- **WHEN** the lead saves a record for a multi-stage Product with a deliberate multi-select while no stage was remembered
- **THEN** the saved record stores both stages
- **AND** no stage becomes the remembered default
- **AND** the next create starts empty

#### Scenario: the remembered stage survives an editor remount

- **GIVEN** Testing is the remembered stage for a multi-stage Product in this draft
- **WHEN** the editor remounts or closes and reopens without a page reload, draft change, or report change
- **THEN** Testing is still the remembered stage
- **AND** the next create still pre-selects Testing alone

#### Scenario: a reload or a draft or report change forgets the remembered stage

- **GIVEN** Testing is the remembered stage for a multi-stage Product in a draft
- **WHEN** the page reloads, or the lead opens another draft or report
- **THEN** no remembered stage is restored
- **AND** a create for a multi-stage Product starts empty and a sole owned stage still auto-applies
- **AND** no sessionStorage, cookie, server preference, or other persistence restores the old stage

#### Scenario: a remembered stage that is no longer available is not selected

- **GIVEN** Testing was the remembered stage for a Product in this draft
- **WHEN** Testing is no longer owned or available to the lead for that Product
- **THEN** Testing is not pre-selected
- **AND** a create starts empty when the Product has multiple owned stages, or auto-applies its sole remaining owned stage
- **AND** an ineligible remembered stage is never emitted in a save

#### Scenario: defaults cannot cross a draft or Product boundary

- **WHEN** creation opens for another Product or lead-section/report draft without a remembered stage of its own
- **THEN** the previous scope's remembered stage is not selected
- **AND** unowned or unavailable remembered stages cannot be emitted in a save

#### Scenario: a contextual prefill overrides the remembered default

- **GIVEN** Development is remembered and the risk opener explicitly supplies Testing for this Product
- **WHEN** Add risk opens
- **THEN** Testing alone is selected, not Development

#### Scenario: changing parent retains existing reset rules

- **WHEN** the lead changes Product or switches to an Activity in an open editor
- **THEN** the previous parent's stage selection is cleared and options follow the new parent
- **AND** Activity parents have no stages while a sole owned Product stage still auto-applies

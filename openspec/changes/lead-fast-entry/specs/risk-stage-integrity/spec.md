## REMOVED Requirements

### Requirement: Record dialogs do not pre-select stages on create

**Reason**: Unconditional empty-on-create conflicts with the owner's editable draft-default decision.

**Migration**: Replace it with the editable draft-stage default below. Its no-memory scenarios preserve empty selection; edit restoration, multi-select, ownership, and required-stage validation remain unchanged.

## ADDED Requirements

### Requirement: Record creation MUST use an editable Product-stage default from this draft

Lead Report Item, Risk, and Decision creation MUST visibly pre-select the last eligible stage chosen for that Product in the same lead-section draft. The default MUST be editable and MUST NOT select all owned stages automatically. Explicit contextual stage prefill MUST win. Without either source, a multi-stage Product MUST start empty; a sole owned stage MUST still auto-apply.

#### Scenario: opening Add item uses a known stage for this Product and draft

- **GIVEN** the draft's eligible last chosen stage for a multi-stage Product is Development
- **WHEN** the lead opens Add item for that Product
- **THEN** Development alone is visibly selected
- **AND** the lead can change or remove it before Save
- **AND** assigning the Product does not select its other stages

#### Scenario: opening Add item shows no stage checked

- **WHEN** Add item opens for a multi-stage Product without an eligible draft choice or explicit prefill
- **THEN** no stage is selected
- **AND** saving without a stage is blocked with `Select at least one stage.`

#### Scenario: opening Add decision shows no stage checked

- **WHEN** Add decision opens for a multi-stage Product without an eligible draft choice or explicit prefill
- **THEN** no stage is selected and a stage-less save is blocked

#### Scenario: editing restores the saved stages

- **WHEN** an existing Item, Risk, or Decision opens in edit mode
- **THEN** its saved stages are restored without substitution by a draft default
- **AND** the selector remains multi-select

#### Scenario: risk creation uses the same editable draft default

- **WHEN** Add risk opens without an explicit prefill and this Product has an eligible last chosen stage in this draft
- **THEN** only that stage is selected and the lead can revise it
- **AND** several stages may be selected deliberately, never merely because they are assigned

#### Scenario: a single owned stage still needs no extra click

- **WHEN** record creation selects a Product with exactly one owned stage
- **THEN** that stage auto-applies visibly without another click

#### Scenario: a default is cleared rather than treated as all stages

- **WHEN** the lead clears the default on a multi-stage Product and saves without another selection
- **THEN** saving is blocked with `Select at least one stage.`
- **AND** emptiness is not expanded to all stages

#### Scenario: defaults cannot cross a draft or Product boundary

- **WHEN** creation opens for another Product or lead-section/report draft without an eligible choice of its own
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

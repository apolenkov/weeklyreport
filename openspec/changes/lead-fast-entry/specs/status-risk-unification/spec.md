## MODIFIED Requirements

### Requirement: The risk-entry dialog stage multi-select does not default to all stages

The Lead Report risk-entry dialog MUST NOT default to all owned stages on a multi-stage Product. An originating-stage prefill MUST select only that stage. Without it, creation MUST follow the editable draft-default contract in `risk-stage-integrity`, including its advance, singleton, and draft-lifetime rules. Product changes MUST reset selection rather than select all stages; deliberate multi-stage coverage MUST remain available.

#### Scenario: opening the dialog with a prefilled stage selects only that stage

- **WHEN** the lead opens the risk-entry dialog from an item's alarm gesture, which prefills a single stage
- **THEN** the stage multi-select has only the prefilled stage checked
- **AND** the other owned stages are unchecked, even if another stage is remembered in this draft

#### Scenario: switching product does not auto-select all owned stages

- **WHEN** the lead changes the Product in the open risk dialog
- **THEN** the previous Product's stage selection is cleared and options follow the new Product
- **AND** the multi-select does not auto-check every owned stage on a multi-stage Product
- **AND** the existing sole-owned-stage shortcut still applies

#### Scenario: a remembered draft choice is a correctable risk default

- **GIVEN** this Product has multiple owned stages and this draft remembers Development
- **WHEN** the lead opens a new risk without an originating-stage prefill
- **THEN** Development alone is visibly selected and can be changed before Save
- **AND** the risk's required text, Impact, Mitigation, and severity remain subject to their existing contracts

#### Scenario: a successful risk save advances the remembered default

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead saves a new risk for that Product with Testing as its only stage and the save succeeds
- **THEN** Testing becomes the remembered stage and the next risk create pre-selects it alone
- **AND** the same remembered stage feeds item and decision creation for that Product in this draft

#### Scenario: cancelling or a failed risk save keeps the previous default

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead changes the risk stage to Testing and cancels, or the risk Save is rejected or fails to persist
- **THEN** Development remains the remembered stage
- **AND** the next risk create still pre-selects Development alone

#### Scenario: a deliberate multi-stage risk save keeps the previous singleton

- **GIVEN** Development is the remembered stage for a multi-stage Product in this draft
- **WHEN** the lead saves a risk covering Development and Testing deliberately
- **THEN** the risk stores both stages and reopens with both selected
- **AND** Development remains the remembered stage and the next risk create pre-selects it alone
- **AND** neither the multi-select nor an all-stage selection becomes a default

#### Scenario: no eligible draft default exists

- **WHEN** Add risk opens for a multi-stage Product without an eligible remembered stage and no explicit prefill
- **THEN** no stage is selected
- **AND** saving requires a deliberate concrete-stage selection rather than interpreting emptiness as all stages

#### Scenario: stage convenience does not change risk derivation

- **WHEN** a risk uses a remembered stage, a sole-owned-stage fallback, or explicit originating-stage prefill
- **THEN** only stage initialization changes; required Impact, Mitigation, and explicit severity keep their existing validation contracts
- **AND** severity and render-floor derivation follow their existing contracts
- **AND** stage ownership and server `safeText` remain enforced

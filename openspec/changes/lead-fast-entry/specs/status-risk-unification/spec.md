## MODIFIED Requirements

### Requirement: The risk-entry dialog stage multi-select does not default to all stages

The Lead Report risk-entry dialog MUST NOT default to all owned stages on a multi-stage Product. An originating-stage prefill MUST select only that stage. Without it, creation MUST follow the editable draft-default contract in `risk-stage-integrity`. Product changes MUST reset selection rather than select all stages; deliberate multi-stage coverage MUST remain available.

#### Scenario: opening the dialog with a prefilled stage selects only that stage

- **WHEN** the lead opens the risk-entry dialog from an item's alarm gesture, which prefills a single stage
- **THEN** the stage multi-select has only the prefilled stage checked
- **AND** the other owned stages are unchecked, even if another stage was last chosen in this draft

#### Scenario: switching product does not auto-select all owned stages

- **WHEN** the lead changes the Product in the open risk dialog
- **THEN** the previous Product's stage selection is cleared and options follow the new Product
- **AND** the multi-select does not auto-check every owned stage on a multi-stage Product
- **AND** the existing sole-owned-stage shortcut still applies

#### Scenario: a remembered draft choice is a correctable risk default

- **GIVEN** this Product has multiple owned stages and the lead last chose Development in the same draft
- **WHEN** the lead opens a new risk without an originating-stage prefill
- **THEN** Development alone is visibly selected and can be changed before Save
- **AND** the risk's required text, Impact, Mitigation, and severity remain subject to their existing contracts

#### Scenario: no eligible draft default exists

- **WHEN** Add risk opens for a multi-stage Product with no eligible remembered stage and no explicit prefill
- **THEN** no stage is selected
- **AND** saving requires a deliberate concrete-stage selection rather than interpreting emptiness as all stages

#### Scenario: stage convenience does not change risk derivation

- **WHEN** a risk uses a remembered stage, a sole-owned-stage fallback, or explicit originating-stage prefill
- **THEN** only stage initialization changes; severity and render-floor derivation follow their existing contracts
- **AND** stage ownership and server `safeText` remain enforced

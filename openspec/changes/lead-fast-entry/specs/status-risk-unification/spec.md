## MODIFIED Requirements

### Requirement: The risk-entry dialog stage multi-select does not default to all stages

The Lead Report risk-entry dialog MUST NOT default to every owned stage checked. An explicit originating-stage prefill MUST select only that stage and take precedence over the last chosen stage for the same Product in this draft. Without a prefill, creation MUST use the editable draft-scoped stage default defined in `risk-stage-integrity`, including its sole-owned-stage shortcut and empty fallback. Product changes MUST clear the previous selection and MUST NOT auto-select all newly owned stages. A risk MAY still deliberately cover several stages; assigning a Product's entire multi-stage scope MUST never be an automatic default. Existing risk severity and render-floor derivation MUST remain unchanged.

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

Code anchors at baseline `99d3651f2`: [risk seed and explicit prefill](../../../../../apps/web/src/features/review/ui/use-risk-edit-parent-stage.ts#L35-L73), [effective single stage](../../../../../apps/web/src/features/review/ui/use-risk-edit-parent-stage.ts#L126-L135), [parent change reset](../../../../../apps/web/src/features/review/ui/use-risk-edit-parent-stage.ts#L173-L183). The shared draft default is proposed; originating-stage prefill, severity, and the reset boundary already exist.

Unchanged invariants: explicit Next wins W+1 rollover; without it unfinished Current continues; at most one active Next per `stableId`; Previous is read-only; `periodState` and lifecycle tuple remain atomic. Risks remain the sole source of at-risk/blocked severity; no default can grant stage ownership or relax server `safeText`.

## ADDED Requirements

### Requirement: Campaign completion requires universal product-floor coverage

The exemplary campaign MUST finish with every current `kind: "product"` file at
catalogue class `A`. The catalogue and completion validator MUST reject any product
file carrying an ESLint suppression, relaxed-budget override, unlinted classification,
or implicit scope exclusion. A path may leave product scope only when its intrinsic
repository role proves a generated, vendored, fixture, or other non-product
classification; relabeling code to evade the floor is forbidden.

#### Scenario: One product file remains outside class A

- **WHEN** the final catalogue contains a product file classified as `B`, `C`, `E`,
  or `F`
- **THEN** the completion validator exits nonzero
- **AND** a percentage ratchet or human exemplary verdict cannot waive the failure

#### Scenario: A path is reclassified to avoid a rule

- **WHEN** a maintained runtime or build-time product file is labelled non-product
  without evidence inherent in its repository role
- **THEN** the catalogue scope probe fails
- **AND** the file remains subject to the universal product floor

### Requirement: Universal coverage is measured from current source

The final `productTotal` and `filesOnFloor` values MUST be regenerated from the final
worktree and MUST be equal. A stored baseline, old catalogue, or earlier campaign
count MUST NOT establish final coverage.

#### Scenario: The baseline matches but the final tree changed

- **WHEN** current product inventory differs from the stored catalogue baseline
- **THEN** the floor check requires catalogue regeneration
- **AND** completion requires `filesOnFloor = productTotal` on the regenerated data

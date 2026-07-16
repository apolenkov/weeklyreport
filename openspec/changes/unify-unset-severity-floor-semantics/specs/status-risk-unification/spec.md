## ADDED Requirements

### Requirement: Unset-severity covering risks floor identically on every surface

A covering risk whose `severity` is unset MUST floor the covered stage, product, and activity to at-risk on every surface — the live lead form, the read-model derivation, and the published snapshot — through the shared `riskSeverityToCanonicalFloor`; no derivation path may filter a covering risk out of flooring for lacking an explicit severity.

#### Scenario: Live form and read model agree on an unset-severity risk

- **GIVEN** a product stage covered by an own risk with no `severity` value
- **WHEN** the lead form renders the stage and the API derives the product's effective status
- **THEN** both surfaces show at least at-risk
- **AND** the published snapshot derived from the same section agrees

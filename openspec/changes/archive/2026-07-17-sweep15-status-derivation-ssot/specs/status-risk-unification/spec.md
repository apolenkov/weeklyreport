## ADDED Requirements

### Requirement: Stage risk coverage and traffic aggregation have one canonical seam

The system MUST compare every risk-to-stage name through the shared `riskCoversStage` predicate built on `stageNamesMatch`, and the report-sections API MUST derive aggregate traffic lights through one domain `aggregateTrafficLight` helper on both the `mergeSection` write path and the Prisma read-model mapper path.

#### Scenario: Legacy Dev risk floors Development everywhere

- **WHEN** a product owns the `Development` stage and a covering risk carries the legacy name `Dev`
- **THEN** the write/read report model and published status derivation treat the risk as covering `Development`
- **AND** the effective product traffic light is identical on every surface

#### Scenario: Populated stage ids remain scoped

- **WHEN** a risk carries `stageIds: ["Testing"]` and status is derived for `Development`
- **THEN** `riskCoversStage` returns false for `Development`
- **AND** that risk does not floor the Development stage or product health through that stage

#### Scenario: Read and write aggregation share precedence

- **WHEN** owned stage traffic values contain green, yellow, and red inputs
- **THEN** both `mergeSection` and the report-section read mapper obtain red from the same domain aggregation helper
- **AND** neither path keeps a private severity-rank implementation

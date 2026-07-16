## ADDED Requirements

### Requirement: Severity ranking and the risk floor mapping have one shared core

The system MUST derive every severity worst-of fold and every risk-severity-to-status floor from one shared core in `packages/shared` (`CanonicalStatus` ladder, `worstCanonicalStatus`, `riskSeverityToCanonicalFloor`, and the canonical↔traffic-light adapters); web and API code MUST NOT keep a private precedence table, worst-of fold, or severity→floor mapping.

#### Scenario: One rule change propagates to every surface

- **WHEN** the risk-severity floor mapping changes in the shared core
- **THEN** the live lead form, the read-model derivation, and the published snapshot all reflect the new mapping without any further edit
- **AND** no file outside `packages/shared` declares a severity precedence table

#### Scenario: Web collapse-down semantics survive the dedup

- **WHEN** a stage carries a manual at-risk or blocked status with no covering risk and no blocked item
- **THEN** `deriveEffectiveStageStatus` still collapses it to on-track
- **AND** the shared core itself carries no collapse-down branch

#### Scenario: Vocabulary adapters agree

- **WHEN** the same risk/item inputs are evaluated through the canonical adapter and the traffic-light adapter
- **THEN** the resulting statuses correspond under `canonicalToTrafficLight`

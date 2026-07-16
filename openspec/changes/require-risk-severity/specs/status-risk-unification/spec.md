## ADDED Requirements

### Requirement: Risk severity is a required contract field

Every risk MUST carry an explicit severity (`at-risk` or `blocked`) through the whole stack — Zod contract, Prisma column without a default, read models, and the shared floor mapping — and no derivation path may carry a branch for an absent severity.

#### Scenario: The contract rejects a severity-less risk

- **WHEN** a risk payload without `severity` reaches the write contract
- **THEN** validation fails loud before persistence
- **AND** the Prisma column declares no default to absorb it

#### Scenario: Floor derivations consume explicit severity only

- **WHEN** `riskSeverityToCanonicalFloor` and its web/API callers are inspected
- **THEN** the floor maps exactly `blocked → blocked` and `at-risk → at-risk`
- **AND** no caller filters or coerces an undefined severity

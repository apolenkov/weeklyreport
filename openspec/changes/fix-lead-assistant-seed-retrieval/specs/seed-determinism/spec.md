## ADDED Requirements

### Requirement: Seed completion verifies Lead assistant retrieval readiness

The canonical and demo seed workflows MUST run a database-backed readiness assertion before reporting success. For their advertised assistant fixtures, the assertion MUST verify canonical current source selection, caller section ownership, non-empty authorized candidate projection, schema-valid populated published snapshots, and unique deterministic occurrence identities. It MUST use the real `ReportSearchPrismaRepository` boundary or an integration harness over the same production mapper and authorization functions.

#### Scenario: Empty current source fails loudly

- **WHEN** a newer eligible seeded live report has no canonical primary-Lead section or projects no candidate
- **THEN** the readiness assertion fails the seed command with a non-zero exit
- **AND** it reports the report identifier and failed readiness stage without printing report text

#### Scenario: Empty or absent published snapshot fails loudly

- **WHEN** a published report advertised for assistant history has a null snapshot, an empty `sections` array, or content that fails canonical snapshot parsing
- **THEN** the readiness assertion fails the seed command with a non-zero exit
- **AND** it does not accept mutable published live rows as a fallback

#### Scenario: Reseeding remains stable

- **WHEN** the same supported seed tier runs twice for the same run week
- **THEN** report, section, record, and occurrence identities remain identical
- **AND** the same current and published candidate kinds pass readiness on both runs

#### Scenario: Automated readiness avoids external AI

- **WHEN** seed readiness or its PostgreSQL integration coverage runs
- **THEN** it performs exact retrieval with deterministic planner/answer fakes or invokes the retrieval boundary below provider orchestration
- **AND** it makes no Mistral request and does not require a populated embedding cache

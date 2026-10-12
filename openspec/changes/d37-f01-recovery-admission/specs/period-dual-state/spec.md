## ADDED Requirements

### Requirement: Current autoArchive provenance requires archived state

Every current shared lifecycle and recovery payload with autoArchived=true MUST have archived=true. The forward Report_auto_archived_state_check constraint MUST enforce this implication alongside the existing Report_lifecycle_tuple_check. Existing archived draft restrictions and all six legal core tuples MUST remain unchanged.

#### Scenario: Contradictory publication recovery flag

- **WHEN** a nonarchived published snapshot row carries autoArchived=true
- **THEN** shared recovery parsing rejects autoArchived before transaction
- **AND** database writes reject the same implication violation

#### Scenario: Valid automatic archive remains accepted

- **WHEN** an archived publication carries autoArchived=true
- **THEN** its lifecycle remains valid
- **AND** an archived draft still cannot carry an automatic archive flag

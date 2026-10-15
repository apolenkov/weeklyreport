# Spec Delta

## ADDED Requirements

### Requirement: Section writes validate stage ownership of new and changed records

A section write MUST reject a new or changed item, risk or decision that
carries a stage the section author does not own on its product. A record
saved back exactly as stored — same stable lineage, same product and the same
stage set — MUST NOT be rejected because its stored stage is no longer owned.
A record without stable lineage MUST be validated. Stored stages MUST NOT be
intersected with or rewritten to the author's current ownership.

#### Scenario: An unchanged record keeps a stage the author lost

- **WHEN** an admin removed the author's stage and the author saves the
  section with that record unchanged while editing another record
- **THEN** the save succeeds and the unchanged record keeps its stored stage

#### Scenario: A reused lineage changes the stage or product

- **WHEN** a payload record reuses a stored `stableId` but changes its stage
  set or moves it to a product where the author owns no such stage
- **THEN** the write is rejected with `STAGE_NOT_OWNED`

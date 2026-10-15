# Spec Delta

## ADDED Requirements

### Requirement: Section writes validate stage ownership of new and changed stages

A section write MUST reject an item, risk or decision that carries a stage the
section author does not own on its product, unless the record keeps its stored
stable lineage and product and carries no stage beyond its stored stages. Such
a record MUST NOT be rejected because a stored stage is no longer owned; its
other fields may change. A record without stable lineage MUST be validated.
Stored stages MUST NOT be intersected with or rewritten to the author's current
ownership.

#### Scenario: A record keeps a stage the author lost

- **WHEN** an admin removed the author's stage and the author saves the
  section with that record's stages unchanged while editing another record
- **THEN** the save succeeds and the record keeps its stored stage

#### Scenario: A record with a lost stage gets new text

- **WHEN** the author edits the text of a record whose stored stage they no
  longer own and keeps its lineage, product and stages
- **THEN** the save succeeds with the new text

#### Scenario: A reused lineage brings a stage or product it did not store

- **WHEN** a payload record reuses a stored `stableId` but adds a stage that is
  not among its stored stages, including in place of a repeated stored stage,
  or moves to a product where the author owns no such stage
- **THEN** the write is rejected with `STAGE_NOT_OWNED`

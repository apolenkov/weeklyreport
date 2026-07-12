## ADDED Requirements

### Requirement: FK and Cascade Columns MUST Be Index-Backed

Every foreign-key column that participates in a `Prisma` relation MUST be
covered by a leftmost database index — either its own `@@index` or as the
leftmost column of a composite index — so a delete that cascades through it,
or a read that filters on it, does not force a sequential scan.

#### Scenario: CarryOver tables index their FK and cascade columns

- **WHEN** `prisma/schema.prisma` is inspected for `CarryOverRecord` and
  `CarryOverExecution`
- **THEN** `CarryOverRecord.executionId` (the `ON DELETE CASCADE` FK to
  `CarryOverExecution`) has its own `@@index`
- **AND** `CarryOverExecution.sourceReportId` and `.targetReportId` (the
  `RESTRICT` FKs to `Report`) each have their own `@@index`

#### Scenario: Review tables index their FK columns

- **WHEN** `prisma/schema.prisma` is inspected for `SectionReview` and
  `ReviewAcknowledgement`
- **THEN** `SectionReview.reviewerId` has its own `@@index`
- **AND** `ReviewAcknowledgement.groupId` has its own `@@index`, distinct
  from the existing `@@index([reportId, groupId])` in which `groupId` is not
  the leftmost column

# schema-conventions Specification

## Purpose

Standardize shared Zod string formats and require index-backed foreign keys, cascades, and consistent sibling validation for the same persisted column.

## Requirements

### Requirement: Shared Schemas MUST Use Top-Level Zod String-Format Validators

Zod string-format validation in the shared schemas, the tRPC router, and the API env schema MUST use the top-level validators (`z.uuid()`, `z.email()`, `z.url()`, `z.iso.datetime()`) rather than the deprecated method-style forms (`z.string().uuid()`, `z.string().email()`, `z.string().url()`, `z.string().datetime()`). Each validator MUST retain the product's canonical accept/reject behavior.

#### Scenario: No deprecated method-style string-format validator remains

- **WHEN** the schema surface (`packages/shared/src/**/*.schema.ts`, `apps/api/src/infrastructure/trpc/trpc.router.ts`, `apps/api/src/infrastructure/config/env.schema.ts`) is scanned for `z.string().uuid(`, `z.string().email(`, `z.string().url(`, or `z.string().datetime(`
- **THEN** zero matches are found
- **AND** every string-format validation site uses the equivalent top-level validator

#### Scenario: Top-level validators preserve the canonical validation boundary

- **WHEN** the shared schemas validate identifiers, URLs, email addresses, and
  ISO datetimes
- **THEN** `z.uuid()` rejects non-RFC-4122 literals and
  `z.url().startsWith("postgresql://")` enforces the `DATABASE_URL` protocol
- **AND** the full test suite and `pnpm typecheck` prove the declared boundary

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

### Requirement: Sibling Schemas Sharing A Column Use The Same Format Validator

Two shared Zod schemas declaring a field for the same underlying database column MUST use the same format-level validator for that field.

For example, `assembledReportSchema.publishedById` and
`reportPeriodSchema.publishedById` both represent `Report.publishedById`. A
schema MUST NOT validate a shared column with a looser type (e.g.
`z.string()`) than a sibling schema already uses for the identical column
(e.g. `z.uuid()`).

#### Scenario: `reportPeriodSchema.publishedById` matches `assembledReportSchema.publishedById`

- **WHEN** `reportPeriodSchema.parse` receives a `publishedById` that is not a
  valid UUID
- **THEN** parsing rejects it, the same way `assembledReportSchema.parse` already
  rejects a non-UUID `publishedById`

### Requirement: Published projections are immutable and independently scopeable

`PublishedSectionScope` and `PublishedSearchDocument` MUST reference only their
owning `Report` through a cascading foreign key. Their frozen section, author,
group, record, and product identifiers MUST NOT reference mutable live tables,
because publication recovery may restore a snapshot without that live graph and
later ownership changes must not rewrite history.

`PublishedSectionScope` MUST have group/report and author/report indexes for
database-side admission. `PublishedSearchDocument.searchTsv` MUST be a stored
generated Russian `tsvector` with a GIN index. Both projections MUST use a
report-leftmost primary key so their Report foreign-key lifecycle is indexed.

#### Scenario: Frozen projection identifiers outlive the live graph

- **WHEN** the schema and canonical init migration are inspected
- **THEN** projection `reportId` columns cascade from `Report`
- **AND** no projection section, author, group, record, or product identifier
  has a foreign key to a mutable table
- **AND** the scope and full-text indexes match the declared query paths

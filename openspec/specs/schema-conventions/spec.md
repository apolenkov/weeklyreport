# schema-conventions Specification

## Purpose

TBD - created by archiving change modernize-zod-string-formats. Update Purpose after archive.

## Requirements

### Requirement: Shared Schemas MUST Use Top-Level Zod String-Format Validators

Zod string-format validation in the shared schemas, the tRPC router, and the API env schema MUST use the top-level validators (`z.uuid()`, `z.email()`, `z.url()`, `z.iso.datetime()`) rather than the deprecated method-style forms (`z.string().uuid()`, `z.string().email()`, `z.string().url()`, `z.string().datetime()`). The change is API-surface only and MUST preserve each validator's accept/reject behavior.

#### Scenario: No deprecated method-style string-format validator remains

- **WHEN** the schema surface (`packages/shared/src/**/*.schema.ts`, `apps/api/src/infrastructure/trpc/trpc.router.ts`, `apps/api/src/infrastructure/config/env.schema.ts`) is scanned for `z.string().uuid(`, `z.string().email(`, `z.string().url(`, or `z.string().datetime(`
- **THEN** zero matches are found
- **AND** the equivalent top-level validator is used at every former call site

#### Scenario: Migration preserves validation behavior

- **WHEN** a top-level validator replaces its method-style predecessor
- **THEN** it accepts and rejects exactly the same inputs (e.g. `z.uuid()` rejects non-RFC-4122 literals just as `z.string().uuid()` did, and `z.url().startsWith("postgresql://")` validates `DATABASE_URL` exactly as before)
- **AND** the full test suite and `pnpm typecheck` pass with no behavior regression

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

For example, `reportSchema.publishedById` and
`reportPeriodSchema.publishedById` both represent `Report.publishedById`. A
schema MUST NOT validate a shared column with a looser type (e.g.
`z.string()`) than a sibling schema already uses for the identical column
(e.g. `z.uuid()`).

#### Scenario: `reportPeriodSchema.publishedById` matches `reportSchema.publishedById`

- **WHEN** `reportPeriodSchema.parse` receives a `publishedById` that is not a
  valid UUID
- **THEN** parsing rejects it, the same way `reportSchema.parse` already
  rejects a non-UUID `publishedById`

# report-section-prisma-payload Specification

## Purpose

TBD - created by archiving change unify-report-section-prisma-payload. Update Purpose after archive.

## Requirements

### Requirement: The report-section mapper's input is a generated Prisma payload

`mapPrismaToReportSection`'s parameter type MUST be derived from Prisma's
generated client via
`Prisma.ReportSectionGetPayload<{include: typeof reportSectionFullInclude}>`,
never a hand-written mirror interface. `reportSectionFullInclude` MUST
satisfy `Prisma.ReportSectionInclude`. No production call site MAY cast a
Prisma query result into this type (or erase it to `any`/`unknown`) — every
producer's query already builds its row from this include or a strict
superset, so the result is directly assignable without a cast.

#### Scenario: the include changes

- **WHEN** a maintainer adds, removes, or renames a relation in
  `reportSectionFullInclude`
- **THEN** every real call site's generated row type changes to match
  automatically, and any consumer reading a field the new include no longer
  provides fails to compile — no separate hand type to remember to update

#### Scenario: a new report-section read is added

- **WHEN** a maintainer writes a new query against `reportSection` using
  `reportSectionFullInclude`
- **THEN** the result passes to `mapPrismaToReportSection` with no cast

### Requirement: The post-save section re-read cannot silently receive null

The write path MUST re-read the just-saved `ReportSection` inside the same
transaction that wrote it, using the same include, and MUST throw
`SectionVersionConflictError` if that re-read is unexpectedly empty — never
cast a nullable Prisma result directly into the mapper.

#### Scenario: a concurrent report deletion races a section save

- **WHEN** an admin deletes the section's report between the save
  transaction's writes and its completion
- **THEN** the cascade-delete's lock acquisition on the just-written rows
  blocks until the save transaction commits, so the re-read inside that
  transaction always finds the row it just wrote

# report-section-prisma-payload Specification

## Purpose

Type report-section mapping and post-save reads from generated Prisma payloads so include drift is visible and an empty re-read fails loudly.

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

- **WHEN** an admin deletes the section's report while a section save is
  in progress
- **THEN** the save transaction's leading compare-and-set already holds
  this `ReportSection` row's write lock for the transaction's duration, so
  the delete's cascade — which needs that same row lock to proceed — blocks
  until the save transaction commits, and the in-transaction re-read always
  finds the row it just wrote

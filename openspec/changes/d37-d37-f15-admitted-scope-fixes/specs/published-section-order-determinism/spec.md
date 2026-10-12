## MODIFIED Requirements

### Requirement: The frozen published snapshot orders sections deterministically

The build path that produces the durable published-report snapshot MUST order
sections by the same comparator the live preview applies
(`authorName` via `localeCompare("ru")`), computed on the mapped read model
inside the shared `buildAssembledReportFromPrismaRow` so every freeze path —
initial publish and re-publish alike — stores exactly the order the head saw.
The query-level `orderBy` on `author.name` with an `id` tiebreak MUST remain as
a deterministic pre-sort, but database collation MUST NOT be the authority for the frozen
order, and identical author display names MUST remain stable through the
`id`-ordered query input.

#### Scenario: Published section order matches the preview order

- **GIVEN** a report with sections authored by three or more different
  leads, created in a non-alphabetical order
- **WHEN** the report is published and its frozen snapshot is read
- **THEN** the sections appear in author-name order under the same
  `localeCompare("ru")` comparator the preview used
- **AND** that order matches the order `getAssembledReport`'s live preview
  produced for the same sections before publishing

#### Scenario: Published section order is stable across reads

- **GIVEN** a published report's frozen snapshot
- **WHEN** it is read multiple times
- **THEN** the section order is identical on every read

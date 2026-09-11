# published-portfolio-snapshot Specification

## Purpose

Define portfolio totals and stage counts derived from the published snapshot read model.

## Requirements

### Requirement: Published snapshots are the sole archive read source

Archive reads MUST use the report's validated `publishedSnapshot`. A published
report without a snapshot, or with a malformed snapshot/record lacking the
required `stableId`, MUST fail closed; archive reads MUST NOT rebuild content
from mutable live section rows.

#### Scenario: An archived report without a snapshot is rejected

- WHEN an archive list or detail read encounters a published archived report
  with no `publishedSnapshot`
- THEN the read fails closed and does not load live section content

#### Scenario: A snapshot record without stableId is rejected

- WHEN lineage inspection encounters an item or decision without `stableId`
- THEN it raises a snapshot-integrity error rather than silently skipping the row

#### Scenario: An admitted archive row must contain a matching scoped section

- GIVEN the database-side `PublishedSectionScope` admission predicate admits an
  archived report for a non-admin session
- WHEN the immutable snapshot is filtered for that same session
- AND the filtered snapshot contains no sections
- THEN the archive list/detail read raises a snapshot-integrity error rather
  than silently dropping the row or returning an empty detail
- BUT a database query that returns no admitted row remains the ordinary
  unauthorized empty/null result

### Requirement: Published portfolio totals are counted once per distinct product

`computePortfolioOverviewFromReadSections` MUST fold every occurrence of a
product across a report's sections into a single effective status before
counting, and MUST increment `totals[status]` exactly once per distinct
`projectId`. It MUST NOT increment `totals` once per (section, project)
occurrence.

#### Scenario: A product co-owned by two lead sections is counted once

- **GIVEN** two lead sections that both reference the same product
  (`projectId`), one with an effective status of `green` and the other `red`
- **WHEN** `computePortfolioOverviewFromReadSections` computes the
  portfolio totals
- **THEN** the product contributes to exactly one of `totals.green`,
  `totals.yellow`, `totals.red` (the worst of the two statuses), not both
- **AND** `totals.green + totals.yellow + totals.red` equals the number of
  distinct products with a non-null effective status, matching the count of
  cards `buildPortfolioProductsFromSnapshotSections` returns for the same
  sections

### Requirement: A product's published stage count is the cross-lead stage union

`buildPortfolioProductsFromSnapshotSections`'s `stageCount` for a product
MUST reflect the union of every stage assigned to any lead on that product
(`project.stageSet`). The published snapshot MUST contain this complete stage
set; a missing `project.stageSet` is a snapshot-integrity error.

#### Scenario: A product's stages split across two leads report the full union

- **GIVEN** a product whose 2 stages are each owned by a different lead (lead
  A owns stage 1, lead B owns stage 2), and both sections' `stageSet` carries
  the full 2-stage union
- **WHEN** `buildPortfolioProductsFromSnapshotSections` computes that
  product's card
- **THEN** `stageCount` is `2`, not `1`

#### Scenario: A published card's stage count agrees with the live preview

- **GIVEN** a product's stage assignments as read by the live path's
  `project.stageAssignments`
- **WHEN** the same underlying assignments are reflected in the published
  read-model's `project.stageSet`
- **THEN** the published card's `stageCount` equals
  `project.stageAssignments.length` as computed by the live
  `buildPortfolioOverview`

### Requirement: Published lineage excludes never-published archives

Published-lineage lookup MUST select snapshot sources whose canonical report
status is `published`. This MUST include a current publication, a reopened
report retaining its prior publication, and a published report that was later
archived. Archiving an unpublished draft MUST NOT make it a publication source
or require a publication snapshot. Snapshot validation for selected
publication sources MUST remain mandatory.

#### Scenario: Unpublished archive coexists with an editable section

- **WHEN** an archived draft retains `status: draft` and has no publication snapshot
- **AND** another populated section requests its published lineage
- **THEN** the archived draft is excluded from snapshot lineage sources and does not make that lookup fail

#### Scenario: Publication-derived lifecycles retain record lineage

- **WHEN** lineage lookup encounters current published, reopened, and archived-published reports
- **THEN** every validated snapshot continues contributing published record identities

#### Scenario: Genuine publication has a corrupt snapshot

- **WHEN** a selected report with `status: published` has a missing or malformed publication snapshot
- **THEN** lineage lookup raises the existing snapshot-integrity error rather than silently skipping that publication

### Requirement: Frozen referenced Products remain in published display membership

`buildPortfolioProductsFromSnapshotSections` SHALL include each Product named
by a frozen section's `referencedProjects` in the published portfolio's
display-only membership. A referenced-only Product SHALL use its frozen real
name, null health, zero stages, and empty health-contributing lead ids and
names. It MUST NOT contribute to published portfolio health totals or acquire
editable stage ownership.

When the same Product is stage-owned in any section, owned Product metadata
SHALL take precedence and the builder SHALL preserve its existing health,
stage-union, lead-attribution, deduplication, and totals behavior.

#### Scenario: Referenced-only records survive Product and PDF projection

- **GIVEN** a frozen section has no stage-owned Product but names a Product in
  `referencedProjects`
- **AND** the section contains an item, risk, or decision parented to that Product
- **WHEN** the published portfolio and weekly-report Product projection are built
- **THEN** one Product card with the frozen real name contains those records
- **AND** its portfolio metadata has null health, zero stages, and no health-contributing leads

#### Scenario: Owned metadata wins over referenced metadata

- **GIVEN** one section stage-owns a Product and another section references the
  same Product with conflicting frozen metadata
- **WHEN** the published portfolio is built
- **THEN** the Product appears exactly once using the owned Product name
- **AND** only owned occurrences contribute health, stages, and lead attribution

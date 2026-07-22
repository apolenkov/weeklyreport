# published-portfolio-snapshot Specification

## Purpose

Define portfolio totals and stage counts derived from the published snapshot read model.

## Requirements

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
(`project.stageSet`), not the `Math.max` of any single lead's own owned-stage
count. When `project.stageSet` is absent (legacy fixtures or frozen
snapshots that pre-date the field), it MAY fall back to the `Math.max`
owned-stages computation.

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

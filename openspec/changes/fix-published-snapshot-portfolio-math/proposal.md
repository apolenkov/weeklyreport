# Fix Published Snapshot Portfolio Math

## Why

`published-report-snapshot.ts` builds the frozen published snapshot's
top-line portfolio totals and per-product cards from the same
`ReportSectionReadModel[]`, but two of its aggregations disagree with each
other and with the live preview on a product co-owned by more than one lead:

- `computePortfolioOverviewFromReadSections` (line 118) loops
  `sections -> section.projects` and increments `totals[status]++` once per
  **(section, project) pair**. A product with two lead sections referencing
  it (the exact co-ownership case `buildEscalationsFromReadSections` already
  dedupes for escalations) is counted twice in the green/yellow/red totals,
  while `buildPortfolioProductsFromSnapshotSections` (line 138) correctly
  collapses the same sections to one card for that product. The file's own
  comment at lines 43-48 says the totals and per-product cards must "agree";
  today they don't — the totals can exceed the product count.
- `buildPortfolioProductsFromSnapshotSections`'s `stageCount` (line 162) is
  computed as `Math.max(current.stageCount, project.ownedStages?.length ?? 0)`
  — the per-lead author's own stage count — instead of the product-wide
  stage union. When a product's stages are split across two leads (lead A
  owns 1 stage, lead B owns a different 1 stage), `Math.max(1, 1)` yields 1
  instead of the true union of 2. The read-model project already carries
  `project.stageSet` (`report-sections.mappers.ts:154-168`), the union of
  every stage assigned to any lead on the product — the same source the live
  path uses (`buildPortfolioOverview` via `project.stageAssignments.length`,
  `weekly-report-portfolio.ts:66`). The published snapshot's card
  under-reports stage count relative to the live preview whenever ownership
  is split.

## What Changes

- `computePortfolioOverviewFromReadSections` dedupes by `projectId` before
  counting: fold every occurrence of a product across sections into one
  worst-status value (the same aggregation
  `buildPortfolioProductsFromSnapshotSections` already performs), then
  increment `totals[status]++` exactly once per distinct product. The sum of
  `totals` after the fix equals the number of distinct products with a
  non-null effective status, matching the per-product card count.
- `buildPortfolioProductsFromSnapshotSections`'s `stageCount` sources the
  product-wide stage union (`project.stageSet.length`) instead of
  `Math.max` over each lead's own `ownedStages.length`, falling back to the
  current `Math.max(ownedStages.length)` behavior only when `stageSet` is
  absent (legacy fixtures/frozen snapshots that pre-date the field, per the
  schema's own documented fallback convention).

## Capabilities

### Added Capabilities

- `published-portfolio-snapshot` — durable requirements for how the
  published snapshot's portfolio totals and per-product cards are derived
  from read-model sections, so future changes to this seam can't
  reintroduce the double-count or the stage-union regression.

## Impact

- Package: `@customreport/api`
- File: `apps/api/src/modules/published-report-snapshot.ts`
  (`computePortfolioOverviewFromReadSections`,
  `buildPortfolioProductsFromSnapshotSections`)
- Downstream consumers exercised by this fix (no code change expected, only
  correct input): `buildAssembledReportFromPrismaRow`, `filterSnapshotSections`,
  `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts`
  (`computePortfolioOverviewFromReadSections`),
  `apps/api/src/modules/weekly-report/weekly-report-read-model.ts`
  (`buildPortfolioProductsFromSnapshotSections`)
- Tests: new/extended cases in
  `apps/api/src/modules/published-report-snapshot.test.ts` covering a
  product co-owned by two lead sections
- No schema change — `project.stageSet` already exists on
  `projectReadModelSchema`

## Non-goals

- Not changing `deriveEffectiveProductStatus` or the own-risk-floor logic
  (`fix-published-empty-stage-risk-floor` / `status-risk-unification`) —
  this change only fixes how already-derived per-project statuses are
  deduped and summed.
- Not changing `buildEscalationsFromReadSections`'s existing co-ownership
  dedupe — it already handles this correctly and is the reference pattern
  this fix follows.
- Not changing the live (non-published) portfolio path
  (`weekly-report-portfolio.ts#buildPortfolioOverview`) — it already
  aggregates per distinct project and already reads
  `project.stageAssignments.length` for the stage-union count; only the
  published-snapshot read-model path is wrong.

## Findings covered

- `apps/api/src/modules/published-report-snapshot.ts:118` —
  `computePortfolioOverviewFromReadSections` increments totals per
  (section, project) pair, double-counting a product co-owned across two
  leads' sections, so totals can exceed the deduped product count and
  contradict the "cards and totals agree" comment at lines 43-48.
  (opus-confirmed)
- `apps/api/src/modules/published-report-snapshot.ts:162` — `stageCount`
  uses `Math.max` over each lead's own `ownedStages.length` instead of the
  product-wide `project.stageSet` union, under-reporting stage count when a
  product's stages are split across leads; diverges from the live path's
  `project.stageAssignments.length`. (codex-miss-verified)

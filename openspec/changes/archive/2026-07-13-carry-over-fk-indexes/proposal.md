## Why

`CarryOverExecution` indexes only its `dedupeKey` unique constraint, and
`CarryOverRecord` has no index at all — so `CarryOverExecution.sourceReportId`
/ `targetReportId` (RESTRICT FKs to `Report`) and `CarryOverRecord.executionId`
(the CASCADE FK back to `CarryOverExecution`) are all unindexed. Deleting an
execution forces Postgres to sequentially scan `CarryOverRecord` to find the
cascading rows, and every report-scoped carry-over lookup scans
`CarryOverExecution` in full. `SectionReview.reviewerId` and
`ReviewAcknowledgement.groupId` have the same gap: both are FK columns with no
leftmost index, unlike every other FK/cascade column in the schema (compare
`ReopenRequest.requestedById`/`reviewedById`, `RecordComment.itemId`/`riskId`/
`decisionId`, all indexed). This is Wave 2 / P2 from the 2026-07-12 repo
excellence review (`docs/reviews/repo-excellence-review-2026-07-12.md`).

## What Changes

- `prisma/schema.prisma`: add `@@index([executionId])` to `CarryOverRecord`;
  add `@@index([sourceReportId])` and `@@index([targetReportId])` to
  `CarryOverExecution`; add `@@index([reviewerId])` to `SectionReview`; add
  `@@index([groupId])` to `ReviewAcknowledgement`.
- `prisma/migrations/20260530162224_init/migration.sql`: hand-add the matching
  five `CREATE INDEX` statements next to the existing index block for these
  tables, per repo convention (single init migration, no new migration
  directory).
- No application code changes — this is purely index coverage for existing
  FK/cascade columns; query shapes and behavior are unchanged.

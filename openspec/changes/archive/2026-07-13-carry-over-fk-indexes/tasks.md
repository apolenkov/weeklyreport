## 1. Schema

- [ ] 1.1 `prisma/schema.prisma`: add `@@index([executionId])` to
      `CarryOverRecord`
- [ ] 1.2 `prisma/schema.prisma`: add `@@index([sourceReportId])` and
      `@@index([targetReportId])` to `CarryOverExecution`
- [ ] 1.3 `prisma/schema.prisma`: add `@@index([reviewerId])` to
      `SectionReview`
- [ ] 1.4 `prisma/schema.prisma`: add `@@index([groupId])` to
      `ReviewAcknowledgement` (the existing `@@index([reportId, groupId])`
      does not cover a `groupId`-only lookup since `groupId` is not the
      leftmost column)

## 2. Migration

- [ ] 2.1 Hand-edit `prisma/migrations/20260530162224_init/migration.sql`:
      add `CREATE INDEX "CarryOverRecord_executionId_idx" ON
"CarryOverRecord"("executionId");`,
      `CREATE INDEX "CarryOverExecution_sourceReportId_idx" ON
"CarryOverExecution"("sourceReportId");`,
      `CREATE INDEX "CarryOverExecution_targetReportId_idx" ON
"CarryOverExecution"("targetReportId");`,
      `CREATE INDEX "SectionReview_reviewerId_idx" ON
"SectionReview"("reviewerId");`, and
      `CREATE INDEX "ReviewAcknowledgement_groupId_idx" ON
"ReviewAcknowledgement"("groupId");` next to that table's existing
      `CREATE INDEX` statements, matching Prisma's generated naming
      convention
- [ ] 2.2 Confirm `prisma migrate diff` between the edited migration and the
      schema reports no drift (empty diff) before reset

## 3. Verification

- [ ] 3.1 `pnpm --filter @customreport/api db:generate`
- [ ] 3.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 3.3 `migrate reset` re-applies the hand-edited migration cleanly on the
      dev database; repeat for the `_test` database used by the integration
      suite, since each DB needs its own reset
- [ ] 3.4 `\d "CarryOverRecord"` / `\d "CarryOverExecution"` /
      `\d "SectionReview"` / `\d "ReviewAcknowledgement"` in `psql` confirms
      the five new indexes exist
- [ ] 3.5 `openspec validate carry-over-fk-indexes --strict`

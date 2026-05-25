# Tasks

- [ ] T1: Create design.md — detail the RiskStage join table schema, migration
      plan, and impact on Prisma relations; cover the race condition mitigation
      and audit trail addition
- [ ] T2: Create Prisma migration — add RiskStage table with UNIQUE
      (draftRiskId, stageCode) constraint
- [ ] T3: Create data migration script — parse existing comma-joined stageCodes
      and populate RiskStage rows (script: `prisma/migrations/data/` folder)
- [ ] T4: Update Prisma schema — add `stages: RiskStage[]` relation to
      DraftRisk model; update Prisma repository queries
- [ ] T5: Refactor `lead-form.prisma-repository.ts:764` — read from
      `draftRisk.stages` array instead of parsing joined string
- [ ] T6: Update web layer — `lead-form.tsx` build stageCodes as an array and
      POST to API; confirm StageMultiSelect integration works
- [ ] T7: Add test cases to cover multi-author stage editing without race
      condition
- [ ] T8: Commit — `refactor(prisma): move risk stages to join table for
    cross-author safety`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test`, Prisma
      validation; manual test with two leads editing same risk

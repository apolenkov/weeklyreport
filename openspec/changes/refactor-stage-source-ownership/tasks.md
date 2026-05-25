# Tasks

- [ ] T1: Create `packages/shared/src/lib/stage-mapping.ts` — define
      `stageCodeToLabel()` and export `STAGE_LABELS` const
- [ ] T2: Extract stage mapping from
      `apps/web/src/lib/mappers/lead-form.ts:296` into the shared module
- [ ] T3: Extract stage mapping from
      `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:764`
      into the shared module
- [ ] T4: Update web consumer — import from shared, verify
      `getStageSelectOptions()` now delegates to the shared source
- [ ] T5: Update API consumer — import from shared, verify both use identical
      logic
- [ ] T6: Grep for any other stage-mapping duplicates (`grep -rn "Dev.*Testing"
    apps/`) and consolidate
- [ ] T7: Commit — `refactor(shared): consolidate stage mapping to single
    source of truth`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      web and API both resolve stage labels identically

# Tasks

> Implementation simplified from original join-table design to native TEXT[] array.
> All tasks completed in single commit e77cbbd1.

- [x] T1: Create migration — `20260525120000_stage_names_array`: drop
      `stageName String?` columns, add `stageNames String[]` on Item/Risk/Decision
- [x] T2: Update Prisma schema — `stageName String?` → `stageNames String[]`
      on all three models; remove per-column indexes
- [x] T3: Update read path (`report-sections.prisma-repository.ts`) — replace
      `stageName.split(", ")` with `stageNames.length > 0 ? stageNames : undefined`
- [x] T4: Update write path — `stageName: join(", ")` → `stageNames: stageIds ?? []`
- [x] T5: Update carry-forward copy path (`lead-form.prisma-repository.ts` lines 151/167/184)
- [x] T6: Update snapshot builder + restore path with backward-compat fallback
      `stageNames ?? stageIds ?? (stageName ? [stageName] : [])`
- [x] T7: Update `CrossAuthorSectionRow` interface — `stageName: string | null` → `stageNames: string[]`
- [x] T8: Fix cross-author select + filter in `lead-form.prisma-repository.ts`;
      remove `TODO(STAGE-CROSS-AUTHOR-MULTI)` comment
- [x] T9: Fix frontend `lead-form.tsx` — filter now uses `.stageNames.some()`;
      mapping uses `stageIds: i.stageNames` instead of `stageName: i.stageName`
- [x] T10: Fix tests — integration test assertion + contract test snapshot fixture
- [x] T-V: Verification — `pnpm typecheck` ✓ (both api + web), `pnpm test` ✓
      (569 web + api tests pass), `prisma migrate reset` ✓

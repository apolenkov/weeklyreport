# Tasks

- [x] T1: Create `packages/shared/src/lib/stage-mapping.ts` — define
      `stageCodeToLabel()` and export `STAGE_LABELS` const

  Created `packages/shared/src/schemas/stage-names.ts` with canonical
  `StageName` type and `STAGE_NAMES` const (using "Development" to match
  DB seeds). Exported from `packages/shared/src/index.ts`.

- [x] T2: Extract stage mapping from
      `apps/web/src/lib/mappers/lead-form.ts:296` into the shared module

  Investigation: `lead-form.ts` uses `"Dev"` (intentional — chip surface
  is narrow per comment at line 340). The API does NOT have a stage mapping
  duplicate (proposal was incorrect). The duplication is only in the web
  layer: `admin.ts` and `mock-data.ts` both had `StageName` + `STAGE_NAMES`.
  `lead-form.ts` kept its local "Dev" variant intentionally.

- [x] T3: Extract stage mapping from
      `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:764`
      into the shared module

  No action needed — line 764 in the API repo is a TODO comment about
  STAGE-CROSS-AUTHOR-MULTI, not a stage label mapping. The API has no
  duplicate stage name array.

- [x] T4: Update web consumer — import from shared, verify
      `getStageSelectOptions()` now delegates to the shared source

  Updated `apps/web/src/lib/mappers/admin.ts`: removed local `StageName`
  and `STAGE_NAMES`, now imports/re-exports from `@customreport/shared`.

- [x] T5: Update API consumer — import from shared, verify both use identical
      logic

  No API consumer to update (see T3). Web consumers `admin.ts` and
  `mock-data.ts` now both source from shared.

- [x] T6: Grep for any other stage-mapping duplicates (`grep -rn "Dev.*Testing"
  apps/`) and consolidate

  Updated `apps/web/src/components/admin/mock-data.ts`: replaced local
  `StageName` type and `STAGE_NAMES` const with re-exports from
  `@customreport/shared`. `stage-assignment-editor.tsx` imports `StageName`
  from `mock-data` (unchanged — re-export preserved the contract).

- [x] T7: Commit — `refactor(shared): consolidate stage mapping to single
  source of truth`

  Committed as `refactor(shared): consolidate stage mapping to single source`.

- [x] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      web and API both resolve stage labels identically

  TypeScript: no errors. Tests: 569/569 (web). Shared typecheck: clean.

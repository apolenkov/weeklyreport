## 1. Shared stage coverage

- [x] 1.1 Add shared `riskCoversStage` in `packages/shared/src/schemas/stage-names.ts`, defining populated, empty, and legacy CSV stage coverage through `stageNamesMatch`
- [x] 1.2 Export the helper from `@customreport/shared` and add unit cases for `Dev`/`Development`, multi-stage CSV, empty `stageIds`, and scoped populated `stageIds`

## 2. API status derivation seam

- [x] 2.1 Add a pure report-sections domain `aggregateTrafficLight` helper with red-over-yellow-over-green-over-null tests
- [x] 2.2 Replace `mergeSection`'s nested aggregation function with the domain helper without changing project-status fallback behavior
- [x] 2.3 Replace `report-sections.status-derivation.ts` rank, worse-of, and `riskCoversStageName` copies with the domain aggregation helper and shared risk coverage
- [x] 2.4 Replace `lead-form.prisma-repository.ts`'s local `normalizeStageName` coverage comparison with `stageNamesMatch` or shared `riskCoversStage`
- [x] 2.5 Add API tests proving `Dev` risks floor `Development` identically in merge, live read mapping, and published snapshot derivation

## 3. Web stage helpers

- [x] 3.1 Remove the alias map and local `riskCoversStage` implementation from `features/report-sections/model/stage-tags.ts`, re-exporting or importing shared stage semantics as appropriate
- [x] 3.2 Remove `"use client"` from pure stage helper modules and update all affected imports without introducing a server/client boundary regression
- [x] 3.3 Update web stage-tag and slide/status tests to use the shared coverage contract

## 4. Scope guard

- [x] 4.1 Confirm the remaining rank/aggregation copies in `sdlc-pipeline-health.ts`, `activity-status-section.tsx`, `weekly-report.ts`, `slide-grid-cells.ts`, `section-slide-utils.ts`, and `lead-form-draft-merge-helpers.ts` are unchanged and recorded for `sweep15-simplify-dedup`

## 5. Repo gates

- [x] 5.1 `pnpm --filter @customreport/api db:generate` (not needed — no Prisma schema change; verified via clean `typecheck`, no TS2339)
- [x] 5.2 scoped equivalent: `pnpm --filter @customreport/shared typecheck`, `pnpm --filter @customreport/api typecheck`, `pnpm --filter @customreport/web typecheck` — all clean
- [x] 5.3 scoped equivalent: `pnpm exec eslint <changed files> --max-warnings 0` — clean
- [x] 5.4 scoped equivalent: vitest run on changed/added unit test files (shared, api, web) plus the real-DB `lead-form.prisma-repository.integration.test.ts` — all passing

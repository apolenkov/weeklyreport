# Tasks

## 1. Implement

- [x] 1.1 Build the report-wide projectId→productName map in
      `mapWeeklyReport` (all sections' projects, then `portfolioOverview`
      overriding) and pass it into `groupRisksByProject` and
      `groupDecisionsByProject`.
- [x] 1.2 Switch both groupers to the shared map for name resolution;
      keep `"Unknown"` only as the genuine-miss fallback and the decisions
      `firstProject` fallback for legacy entries without `productId`.

## 2. Verify

- [x] 2.1 Regression tests in `weekly-report.test.ts`: risk and decision
      referencing a project missing from the author's section but present
      in `portfolioOverview` resolve the real name; a truly unknown id
      still yields "Unknown".
- [x] 2.2 Gates green (`pnpm typecheck && pnpm lint && pnpm test`); live
      check on head week-23 report — «Маркетинговый портал» risk badges
      name the product instead of "Unknown".

## Evidence (2026-06-10)

- 1.1/1.2: `buildProjectNameMap()` in `weekly-report-groupers.ts` (extracted
  as a helper to stay under the cognitive-complexity budget); both groupers
  take the map as a parameter.
- 2.1: regression test "product name resolution" in `weekly-report.test.ts`
  — cross-section risk badge resolves to `Mobile · Analysis`, decision badge
  to `Mobile` (18/18 mapper tests green).
- 2.2: gates green (typecheck / lint / test); live check on head week-23:
  «Маркетинговый портал · Analysis/Design/Planning/Development» — no
  "Unknown" badges remain.

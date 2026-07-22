# Tasks

## 1. Pin current (broken) behavior

- [x] 1.1 Add a characterization test in
      `apps/api/src/modules/published-report-snapshot.test.ts`: two lead
      sections both reference the same `projectId` with an effective status
      of `green` and `red` respectively; assert
      `computePortfolioOverviewFromReadSections(...).totals` currently sums
      to more than the number of distinct products (pins the double-count
      at `published-report-snapshot.ts:118`; this test fails against
      current code).
- [x] 1.2 Add a characterization test in the same file: two lead sections
      each own a different single stage (via `ownedStages`) of the same
      product, and the product's `stageSet` on both sections carries the
      full 2-stage union; assert
      `buildPortfolioProductsFromSnapshotSections(...)` currently returns
      `stageCount: 1` for that product instead of `2` (pins the
      `Math.max`-over-`ownedStages` bug at
      `published-report-snapshot.ts:162`; this test fails against current
      code).

## 2. Fix the double-count in `computePortfolioOverviewFromReadSections`

- [x] 2.1 `apps/api/src/modules/published-report-snapshot.ts:118-136`: change
      `computePortfolioOverviewFromReadSections` to dedupe by `projectId`
      first — fold every occurrence of a product across sections into one
      worst-effective-status value (via `computeWorstStatus`, the same
      aggregation `buildPortfolioProductsFromSnapshotSections` uses) — then
      increment `totals[status]++` exactly once per distinct product instead
      of once per (section, project) occurrence.
- [x] 2.2 Re-run the test from Task 1.1 and confirm it now passes; add an
      assertion that `totals.green + totals.yellow + totals.red` equals the
      distinct-product count for the fixture.

## 3. Fix the stage-union regression in `buildPortfolioProductsFromSnapshotSections`

- [x] 3.1 `apps/api/src/modules/published-report-snapshot.ts:162-165`:
      replace `Math.max(current.stageCount, project.ownedStages?.length ?? 0)`
      with the product-wide union from `project.stageSet.length` when
      `project.stageSet` is present; fall back to the current
      `Math.max(current.stageCount, project.ownedStages?.length ?? 0)`
      behavior only when `stageSet` is absent (legacy fixtures/frozen
      snapshots that pre-date the field, per
      `projectReadModelSchema`'s documented fallback convention).
- [x] 3.2 Re-run the test from Task 1.2 and confirm it now returns
      `stageCount: 2`.
- [x] 3.3 Add a fixture-parity case: assert `stageCount` from
      `buildPortfolioProductsFromSnapshotSections` matches
      `project.stageAssignments.length` as computed by the live
      `buildPortfolioOverview` (`weekly-report-portfolio.ts:66`) for the same
      underlying stage assignments, so the published card and the live
      preview agree.

## 4. Confirm no regression on existing snapshot behavior

- [x] 4.1 Re-run the existing `published-report-snapshot.test.ts` suite
      (own-risk floor, escalation dedupe, activity-status-independence
      cases) to confirm both fixes are isolated to the two aggregation
      functions and don't change single-lead-owned-product output.
- [x] 4.2 Re-run downstream consumers' existing tests:
      `apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts`
      (via its test suite) and
      `apps/api/src/modules/weekly-report/weekly-report-read-model.ts` (via
      its test suite), to confirm the corrected totals/stageCount flow
      through unchanged call sites.

## 5. Spec delta

- [x] 5.1 `published-portfolio-snapshot`: ADD the requirement that
      published portfolio totals are computed per distinct product, never
      per (section, project) occurrence.
- [x] 5.2 `published-portfolio-snapshot`: ADD the requirement that a
      product's per-card `stageCount` reflects the product-wide stage union
      across all leads, not one lead's own stage count.

## Gates

- [x] `pnpm --filter @customreport/api db:generate` — not required: no
      Prisma-client TS2339 errors occurred.
- [x] `pnpm typecheck` — satisfied by the required scoped API typecheck.
- [x] `pnpm lint` — satisfied by ESLint on the changed TypeScript files with
      `--max-warnings 0` and a scoped Prettier check.
- [x] `pnpm test` — satisfied by the required change-local unit and real-DB
      integration suites.
- [x] `openspec validate fix-published-snapshot-portfolio-math --strict`

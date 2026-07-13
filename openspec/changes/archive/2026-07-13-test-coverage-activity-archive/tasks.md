## 1. `getLiveActivity` branch coverage

- [ ] 1.1 In `activity.prisma-repository.integration.test.ts`, add a lead
      with a reporting-group user but no `ReportSection` row for the current
      report; call `getLiveActivity` as the head and assert that lead's row
      has `status: "draft"`, `itemCount: 0`, `lastEditAt: null`
- [ ] 1.2 Add a second lead in the same group whose section is `status:
"submitted"` with an `Item` row carrying a later `updatedAt` than the
      draft lead's most recent record; assert the draft-status lead sorts
      before the submitted-status lead in `result.rows`
- [ ] 1.3 For the sort-comparator fixture, seed each lead's section with at
      least two of: an `Item`, a `Risk`, a `Decision`, and a `RecordComment`
      with distinct `updatedAt`/`createdAt` values; assert each row's
      `lastEditAt` equals the max timestamp across that lead's own records,
      not just the section's own `updatedAt`

## 2. Archive cross-group section isolation

- [ ] 2.1 In `archive.integration.test.ts`, seed two reporting groups (A, B)
      each with a lead and a `ReportSection` attached to the same published,
      archived `Report`
- [ ] 2.2 Call the archive repository's list or `getArchiveReport` method
      with an `ArchiveScopeSession` scoped to group A on a row that carries a
      persisted `publishedSnapshot`; assert the returned sections/records
      belong only to group A and the recomputed `portfolioOverview` excludes
      group B's risks
- [ ] 2.3 Repeat 2.2 for a row with no `publishedSnapshot` (forcing
      `loadFallbackGraphs`); assert the same group-A-only isolation holds on
      the fallback path
- [ ] 2.4 Assert a head or lead session scoped to group B, reading the same
      report, sees only group B's sections — confirming the filter is
      symmetric, not just "A excludes B"

## 3. Spec delta

- [ ] 3.1 `activity-reporting-unit`: ADD a requirement that `getLiveActivity`
      has regression coverage for the no-section draft case, the
      draft-first sort order, and the multi-source `lastEditAt` max
- [ ] 3.2 `repository-scope-guard`: ADD a requirement that the archive
      repository's group-scoped section filter has regression coverage for
      cross-group isolation on both the snapshot-hit and fallback read paths

## 4. Verification

- [ ] 4.1 `pnpm --filter @customreport/api db:generate`
- [ ] 4.2 `cd apps/api && pnpm exec vitest run src/modules/activity/activity.prisma-repository.integration.test.ts src/modules/archive/archive.integration.test.ts`
- [ ] 4.3 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 4.4 `openspec validate test-coverage-activity-archive --strict`

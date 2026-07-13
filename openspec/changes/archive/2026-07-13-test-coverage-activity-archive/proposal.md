## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

`getLiveActivity`'s three most logic-bearing branches — the no-section
"draft" case, the draft-first sort comparator, and the multi-source
`lastEditAt` max — are never exercised by
`activity.prisma-repository.integration.test.ts`. Every existing fixture
gives both leads a `ReportSection`, and every assertion checks only
`reportId`, `rows.length`, and `leadId`, so a regression in any of those
three branches would pass the suite silently.

`archive.prisma-repository.ts`'s group-scoped section filter
(`sectionScopeWhere` composed into `filterSnapshotSections` and the
fallback-graph `sections.where`) is the authz-isolation path wired into
production for lead and head archive reads, and it has zero test coverage:
every existing archive repository test calls the repository with no scoped
session, so a regression that widened `sectionScopeWhere` to leak another
group's sections — on either the snapshot-hit or the full-row fallback
path — would go uncaught until a user reported seeing another group's data.

## What Changes

- `apps/api/src/modules/activity/activity.prisma-repository.integration.test.ts`:
  add a case for a lead with zero `ReportSection` rows, asserting the
  returned row has `status: "draft"`, `itemCount: 0`, and `lastEditAt: null`.
  Add a case with one draft-status lead and one submitted-status lead (with
  differing record/comment timestamps) asserting the draft lead sorts first
  and each row's `lastEditAt` is the max across items, risks, decisions, and
  comments for that lead's section.
- `apps/api/src/modules/archive/archive.integration.test.ts`: add a case that
  publishes two `Report`s (or one report with sections split across two
  reporting groups), each carrying sections from two different groups, then
  calls `getArchiveReport`/the paginated list method with a lead or head
  session scoped to group A and asserts only group-A sections and the
  group-A-recomputed `portfolioOverview` are returned — once for a row with
  a persisted `publishedSnapshot` (snapshot-hit path) and once for a row
  without one (fallback `loadFallbackGraphs` path).
- No production code changes. This is test-coverage-only; both spec deltas
  below record the coverage as a durable requirement so a future PR that
  removes these tests trips spec/test drift review.

## Impact

- `apps/api/src/modules/activity/activity.prisma-repository.integration.test.ts`
- `apps/api/src/modules/archive/archive.integration.test.ts`

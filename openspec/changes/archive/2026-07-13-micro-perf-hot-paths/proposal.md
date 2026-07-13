## Why

Wave 3 / P3 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

Three independent micro-inefficiencies sit on the two hottest read paths
(session hydration on every authenticated tRPC call, and `getWeeklyReport`):

- `hydrateOrganization` (`trpc.session-hydration.ts`) runs a Prisma `upsert`
  — a write — on every cache-miss of its 5-second TTL, with no in-flight
  dedup. The `Organization` singleton row is already seeded at migration
  time, so the write branch almost never needs to fire, yet every concurrent
  cold request in a TTL-expiry window still issues its own `upsert` against
  the same primary key, taking a write lock the read path does not need.
- `getWeeklyReport` (`weekly-report.prisma-repository.ts`) awaits
  `reminderPolicy.count` as a third serial round-trip after the existing
  `Promise.all([leadUsers, projects])`, even though the count depends only
  on `report.deadline`, which is already available before that `Promise.all`
  starts.
- The same method's `projects` query always includes the (relatively heavy)
  `stageAssignments` relation, but on the published-report branch `projects`
  is used only to compute the cross-group audit signal (needs `id` and
  `lead.reportingGroupId`) — `stageAssignments` is consumed only by
  `buildPortfolioOverview` on the live (non-published) branch.

None of the three has a correctness impact — each is an avoidable write,
round-trip, or over-fetch on a hot path.

## What Changes

- `apps/api/src/infrastructure/trpc/trpc.session-hydration.ts`:
  `hydrateOrganization`'s cache-miss branch reads with `organization.findUnique`
  first; only falls back to `upsert` when the singleton row is unexpectedly
  absent (mirrors the existing read-then-write-on-absence pattern in
  `organization.prisma-repository.ts`'s `getOrganization`). The 5s TTL cache
  itself is unchanged.
- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`:
  fold `reminderPolicy.count` into the existing `Promise.all` alongside
  `leadUsers` and `projects` (it only needs `report.deadline`, already
  available at that point), so the three independent reads dispatch
  concurrently instead of the count running as a third serial await.
- Same file: shape the `projects` query's `include` by `report.periodStatus`
  (known before the query runs, since `report` is fetched first) — include
  `stageAssignments` only when the branch that consumes it (the live/
  non-published path) will run; the published branch selects just `id` and
  `lead.reportingGroupId`, the fields `computeCrossGroupSignal` and the
  surfaced-product-id filter actually use.

This change lands after `fix-published-crossgroup-audit`, which touches the
same repository method's published branch (the `projects`/cross-group
computation) — sequencing avoids a merge conflict on the same lines, not a
functional dependency.

## Impact

- `apps/api/src/infrastructure/trpc/trpc.session-hydration.ts`
- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts`

Non-goals: no change to the 5s TTL cache design, no change to the
`reminderPolicy.count` query's filter semantics, no change to what
`buildPortfolioOverview` or `computeCrossGroupSignal` compute — only which
fields are fetched and when.

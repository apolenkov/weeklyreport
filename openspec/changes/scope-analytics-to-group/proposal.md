## Why

Any authenticated user can read every group's published reports through the
analytics surface. The three analytics read paths
(`trafficLightHistory`, `leadVelocity`, `periodComparison` in
`apps/api/src/modules/analytics/analytics.prisma-repository.ts`) query
`prisma.report` with only a `published` floor and no group-scope filter, so a
head or lead of group A sees group B's project statuses, leads, and risks. This
is the P0-5 cross-group read leak from the 2026-06-28 repo-excellence review.

The `groupScopeFilter(session, "reportSection")` helper is already established:
`compiledHistory` (`trpc.router.ts`) and the archive repository thread
`ctx.session` and apply it. Analytics is the one read surface that skipped
scoping entirely. But analytics needs the stronger variant: because it
aggregates the contents of a report's included sections (not just a period
list), the closest precedent is `weekly-report.prisma-repository.ts`, which
scopes the nested included sections — see the design for why a report-level
filter alone would still leak co-located group-B sections.

## What Changes

- Thread `ctx.session` from the three `analytics.*` tRPC procedures into
  `AnalyticsService` and the `AnalyticsRepository` methods. **BREAKING** to the
  internal repository/service method signatures (not the tRPC input contract).
- Apply `groupScopeFilter(session, "reportSection")` to the nested
  `include.sections.where` in all three repository methods — the load-bearing
  fix, since a single `Report` is a unified period holding sections from every
  group and the methods aggregate over those included sections. This mirrors
  `weekly-report.prisma-repository.ts`, NOT `compiledHistory`: that path returns
  only the period list, so a report-level filter suffices there, but analytics
  reads section contents and must scope the included sections. Additionally keep
  an optional top-level `sections: { some: <scope> }` only to drop periods with
  no in-scope section. Admin → both omitted (no filter); viewer with no granted
  groups → zero rows.
- Fold a scope discriminator into the analytics Redis cache key so a result
  computed for group A is never served from cache to group B. Today the key
  hashes only the input.
- Call `guardGroupScope(session)` at each repository entry so a future caller
  that forgets to thread the session fails loudly instead of leaking.

## Capabilities

### New Capabilities

- `analytics-group-scope`: the analytics read paths bound every report query to
  the caller's authorised reporting group(s), with admin unfiltered, and isolate
  the cache per scope so the filter cannot be bypassed by a cache hit.

### Modified Capabilities

<!-- none: repository-scope-guard governs different methods with ScopeGuardError-on-empty
     semantics; scope-accessed-audit governs audit events. This change reuses the
     existing guardGroupScope helper but adds no requirement to either. -->

## Impact

- Code: `analytics.prisma-repository.ts`, `analytics.service.ts` (interface +
  impl), `analytics.cache.ts` key derivation, `trpc.router.ts` analytics block.
- Reuses `groupScopeFilter` / `guardGroupScope` from `apps/api/src/lib/group-scope.ts`.
- Tests: `analytics.service.test.ts` (cache-key isolation) plus a repository /
  integration scope test (group A cannot read group B).
- No schema change, no tRPC input-shape change, no UI change.

## Non-goals

- Fixing the analytics date-comparison bugs (separate change
  `fix-analytics-date-matching`, P1-5).
- Changing `repository-scope-guard` or `scope-accessed-audit` requirements.
- Emitting a `scopeAccessed` audit event for analytics reads.

## Context

The analytics surface has three read paths — `trafficLightHistory`,
`leadVelocity`, `periodComparison` — wired as `anyRoleProcedure` in
`trpc.router.ts`, delegating to `AnalyticsService`, which reads through a Redis
cache (`AnalyticsCache`) before hitting `AnalyticsPrismaRepository`. The
repository queries `prisma.report` with only `PUBLISHED_FLOOR` and the
period/lead/project filters. No group scope is applied, so any authenticated
caller reads every group's published data (P0-5, 2026-06-28 review).

The canonical fix already exists elsewhere: `compiledHistory` and
`ArchivePrismaRepository.sectionScopeWhere` thread `ctx.session` and spread
`groupScopeFilter(session, "reportSection")` into the report `where`. The helper
lives in `apps/api/src/lib/group-scope.ts` and already encodes per-role
visibility (admin → `{}`, head/lead → own group, viewer → granted groups,
viewer-empty → zero rows). This change brings analytics to that same pattern.

A second, less obvious hole: the service caches on `stableHash(input)` only.
Even after the where-clause is scoped, a result computed for group A would be
served from Redis to group B on an identical input — the cache must be
partitioned by scope.

## Goals / Non-Goals

**Goals:**

- Bound all three analytics report queries to the caller's authorised group(s),
  admin unfiltered, reusing `groupScopeFilter(session, "reportSection")`.
- Partition the analytics cache by a scope discriminator so the filter cannot be
  bypassed by a cache hit.
- Fail loud (`guardGroupScope`) when a caller omits the session.

**Non-Goals:**

- The analytics date-comparison bugs (separate `fix-analytics-date-matching`).
- A `scopeAccessed` audit event for analytics (out of scope; see
  `scope-accessed-audit`, which covers the weekly-report read only).
- Changing the tRPC input contract or any UI.

## Decisions

### 1. Scope the nested `include.sections.where`, target `reportSection`

A single `Report` is a unified period row holding `sections` from ALL groups
(`Report.sections ReportSection[]` in `schema.prisma`; this is exactly why
`scope-accessed-audit` exists — one read surfaces cross-group products). All
three analytics methods `include` the report's sections with no nested `where`
and aggregate over `r.sections` (`projectStatuses`, `author`, `risks`). So a
report-level filter alone is the WRONG fix: it only decides which reports
return, then pulls in every co-located section regardless of group, leaking
group-B projects/leads/risks via a report that matched on a group-A section.

This is the trap of "parity with `compiledHistory`": that path returns only the
period LIST, so a report-level filter suffices. Analytics aggregates section
CONTENTS, so it must filter the INCLUDED sections — the pattern
`weekly-report.prisma-repository.ts` already uses (`include.sections.where`).

Apply `groupScopeFilter(session, "reportSection")` to the nested
`include.sections.where` in all three methods, and additionally keep a
top-level `sections: { some: <scope> }` to drop periods with no in-scope
section. Alternative — target `project` — was rejected: it would filter
projects, not sections.

Before (`trafficLightHistory`):

```
where:   { ...PUBLISHED_FLOOR, periodStart, periodEnd, ...leadSome }
include: { sections: { include: { projectStatuses: { include: { project } } } } }
```

After (non-admin):

```
where:   { ...PUBLISHED_FLOOR, periodStart, periodEnd,
           sections: { some: { ...leadFilter, ...scope } } }      // drop empty periods
include: { sections: { where: scope,                              // the load-bearing line
                       include: { projectStatuses: { include: { project } } } } }
```

For `leadVelocity` the nested `where` merges the scope with the existing
`status: "submitted"` section filter. Admin yields `{}` and BOTH the nested
`where` and the top-level `sections.some` scope clause are omitted (parity with
`sectionScopeWhere` returning `undefined` for admin).

### 2. Thread `session` as an explicit method parameter, not via input

Add `session: UserSession` to the `AnalyticsRepository` interface methods, their
Prisma implementations, and the `AnalyticsService` methods; the tRPC resolvers
pass `ctx.session`. Alternative — add scope to the Zod input schema — was
rejected: scope must originate from the authenticated context, never from
client-supplied input, and a cacheable input field would be spoofable.

### 3. Cache key carries a scope discriminator

Derive a stable discriminator from the session and prepend it to the hashed
input: `"admin"` for admin, otherwise the sorted authorised group ids joined by
a reserved delimiter. Build it from the same source `groupScopeFilter` uses so
the two never disagree. Two callers with different authorised group sets compute
different keys; two callers with the same set share the entry. This keeps the
hour-TTL cache and the existing `invalidateAll` SCAN prefix intact (the
discriminator sits inside the per-call key suffix, under the same
`customreport:analytics:*` root).

### 4. Reuse `guardGroupScope` for the missing-session guard

Call `guardGroupScope(session)` at each repository method entry. It throws only
on `undefined`; a defined admin session passes. This is the defensive backstop
for a future callsite that forgets to thread the session — complementary to,
not a modification of, the `repository-scope-guard` capability (which governs
`findDraftSections` / `findReports` / period queries with its own
ScopeGuardError-on-empty semantics).

## Risks / Trade-offs

- [Stale cache entries written before the key change served cross-group] →
  Mitigation: the key shape changes, so old un-scoped keys are simply never
  read again; they age out at the 1h TTL. No manual flush required, but a
  one-time `invalidateAll` on deploy is a clean option.
- [Group-id set assembled into the cache key could collide if naively
  concatenated] → Mitigation: sort the ids and join with a delimiter that
  cannot appear in a UUID; admin uses a distinct literal token.
- [A new analytics read method added later forgets the session] → Mitigation:
  `guardGroupScope` throws at runtime; the regression test and the
  spec's named-method list make the omission reviewable.
- [Viewer with empty access] → `groupScopeFilter` already returns a zero-row
  predicate (`{ id: { in: [] } }`); analytics inherits that behavior, returning
  empty rather than leaking.

## Invariants

- Preserves: `PUBLISHED_FLOOR` parity with the archive read; role-coverage gate
  (procedures stay `anyRoleProcedure`, only the resolver body changes); Zod
  parse at every boundary.
- Mutates: internal `AnalyticsRepository` / `AnalyticsService` method signatures
  (gain a `session` parameter) and the cache-key derivation.
- Untouched: Prisma schema (no migration), destructive-db guard, deferred-feature
  pattern, tRPC input schemas, apps/web.

## Migration Plan

Pure code change, no schema migration. Deploy the API; optionally run
`AnalyticsCache.invalidateAll()` once so no pre-change un-scoped entry survives
its TTL. Rollback is a straight revert — no data migration to undo.

## Open Questions

- None blocking. Whether to export `computeAllowedGroupIds` from
  `group-scope.ts` for cache-key reuse, or add a small dedicated
  `scopeDiscriminator(session)` helper, is an implementation detail for review.

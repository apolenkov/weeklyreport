# Phase 30, Plan 01 — SUMMARY

**REQ-IDs:** ANAL-01
**Commit:** `acc6929 feat(30-01): ANAL-01 analytics.trafficLightHistory + Redis cache + period invalidation`

## Module shape

```
apps/api/src/modules/analytics/
  analytics.module.ts            -- Nest module exporting AnalyticsService + AnalyticsCache
  analytics.service.ts           -- Domain service (Prisma-free); 3 methods (only trafficLightHistory exposed in this commit; leadVelocity/periodComparison wired in 30-02)
  analytics.service.test.ts      -- 11 unit tests (empty, populated, cache-hit, key-stability)
  analytics.prisma-repository.ts -- Prisma implementation with PUBLISHED_FLOOR
  analytics.cache.ts             -- ioredis wrapper, SCAN+DEL invalidation, fail-open
  analytics.cache.test.ts        -- 3 contract tests via in-memory fake
```

`AnalyticsService` accepts an `AnalyticsCachePort` (`getOrCompute`) so unit tests pass an in-memory fake. The real `AnalyticsCache` (ioredis) is wired by `AnalyticsModule`.

## Cache key format and TTL

- Prefix: `analytics:traffic-light:` (and `analytics:lead-velocity:` / `analytics:period-comparison:` defined for 30-02).
- Key body: `JSON.stringify(input, sortedKeys)` — stable regardless of property order in the call site.
- TTL: 3600s.

## Invalidation seam

`PeriodService` constructor takes a second arg `invalidateAnalyticsCache: () => Promise<void>` (default no-op). `period.module.ts` wires `() => analyticsCache.invalidateAll()`. Both `publishPeriod` and `reopenPeriod` call the invalidator after the repository write succeeds — but NOT when validation throws (verified by test).

`AnalyticsCache.invalidateAll()` uses Redis SCAN (cursor-based, non-blocking) over the `analytics:*` prefix and DELs in batches of 100. Failures are non-fatal — the worst-case is reads stay stale until the 1h TTL expires.

## Test counts

- Baseline (Phase 29 / pre-30): **473** unit tests (api).
- After 30-01: **487** (+14).
  - +8 in analytics.service.test.ts.
  - +3 in analytics.cache.test.ts.
  - +3 in period.service.test.ts (publish invalidates, reopen invalidates, publish-failure does not invalidate).

## Files

- apps/api/src/modules/analytics/* (created)
- apps/api/src/modules/period/period.service.ts (invalidator port added; default no-op preserves existing tests)
- apps/api/src/modules/period/period.service.test.ts (3 new assertions)
- apps/api/src/modules/period/period.module.ts (AnalyticsCache injection)
- apps/api/src/app.module.ts (AnalyticsModule registered)
- apps/api/src/main.ts (analyticsService threaded into createAppRouter deps)
- apps/api/src/infrastructure/trpc/trpc.router.ts (analytics namespace + trafficLightHistory procedure)
- packages/shared/src/schemas/analytics.ts (Zod schemas for all 3 procedures — leadVelocity / periodComparison schemas land now so 30-02 only adds router lines + TZ test)

## Notes

- adminProcedure === headProcedure parity preserved — analytics is anyRoleProcedure (heads, leads, admins, viewers all read with the published-only floor).
- The PUBLISHED_FLOOR pattern mirrors `archive.prisma-repository.ts`; viewers see only published periods.
- Server formats period labels via `Date.prototype.toISOString().slice(0, 10)` — UTC, TZ-stable. The cross-TZ assertion lands in 30-02.

# Phase 30, Plan 02 — SUMMARY

**REQ-IDs:** ANAL-02, ANAL-03
**Commit:** `705dcb5 feat(30-02): ANAL-02/03 leadVelocity + periodComparison + TZ-stable labels`

## Procedure shapes

```
analytics.leadVelocity({ periodFrom, periodTo })
  -> Array<{ periodLabel: 'YYYY-MM-DD', leads: Array<{ leadId, leadName, submittedSections }> }>

analytics.periodComparison({ periodA, periodB })
  -> { rows: Array<{ projectId, projectName,
                     statusA, statusB,
                     riskCountA, riskCountB,
                     riskDelta }> }
```

Both procedures sit on `anyRoleProcedure`; the repository enforces `PUBLISHED_FLOOR` mirroring `archive.prisma-repository.ts`.

## TZ stability proof

`apps/api/src/modules/analytics/analytics.tz.test.ts` flips `process.env.TZ` between `Europe/Moscow` and `UTC` and asserts:

1. `AnalyticsService.trafficLightHistory(input).periods` is byte-identical across both TZs.
2. `AnalyticsService.leadVelocity(input)` returns an identical `periodLabel` array across both TZs.
3. `Date.prototype.toISOString().slice(0, 10)` itself is TZ-stable (sanity check on the Node primitive).

The Prisma repository uses `Date.toISOString().slice(0, 10)` exclusively — no `toLocaleDateString`, no string-to-Date round trips without the Z suffix.

## Cache key prefixes

- `analytics:traffic-light:` (30-01)
- `analytics:lead-velocity:` (30-02)
- `analytics:period-comparison:` (30-02)

All three are wiped by `AnalyticsCache.invalidateAll()` on PeriodService publish/reopen via the SCAN+DEL prefix sweep.

## Test counts

- Before 30-02: 487 unit tests.
- After 30-02: **489** (+2 in analytics.tz.test.ts).

## Files

- apps/api/src/modules/analytics/analytics.tz.test.ts (created)
- apps/api/src/infrastructure/trpc/trpc.router.ts (router exposes leadVelocity + periodComparison)

## Notes

- The schemas were already authored in 30-01 (forward-declared). 30-02 only adds the TZ test and the two router handlers.
- The Prisma repo pattern for `leadVelocity` returns one row per `(periodLabel, leadId)` rather than performing a true Postgres GROUP BY — the section-per-author shape is enforced by the `(reportId, authorId)` unique index in schema.prisma so the iteration cost is bounded.

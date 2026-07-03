# Per-file audit — apps/api/src/modules/analytics (2026-07-02)

Read-only audit, wave 1. 4 files reviewed.

Kept: 10 findings across 3 files (1 file clean). Killed by verification: 1.

## analytics.cache.ts (3 findings)

| Lines | Dimension   | Severity | Finding                                                                                                                                                                                                          | Suggestion                                                                                                                                                    | Your verdict |
| ----- | ----------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1-86  | duplication | medium   | Near-verbatim structural duplicate of `telemetry.cache.ts` — same constructor Redis-setup, same try/getOrCompute-on-miss/setex/swallow-errors shape, same `onModuleDestroy`; differs only in TTL and key PREFIX. | Factor a shared `RedisCacheBase`/`createRedisCache({ ttlSeconds, prefix })`; make AnalyticsCache and TelemetryCache thin wrappers. Cuts ~60 duplicated lines. |              |
| 13-23 | comments    | medium   | 11-line class-level JSDoc on `AnalyticsCache` — over the 3-line comment budget — explains degrade behavior, SCAN-vs-KEYS choice, PeriodService wiring.                                                           | RELOCATE: 1-2 line pointer to an ADR/spec; keep the SCAN-vs-KEYS rationale as a 1-line inline note above the `scan()` call.                                   |              |
| 8-10  | comments    | low      | Comment references 'Phase 32-C / M-04' — ticket/phase archaeology git history already holds.                                                                                                                     | Delete the phase/ticket prefix; keep the app-namespacing rationale in <=1 line if still needed.                                                               |              |

Already good: correct defensive design — SCAN+DEL for invalidation instead of blocking KEYS, and every Redis call wrapped so an outage degrades to direct compute rather than breaking the read path.

## analytics.prisma-repository.ts (5 findings)

| Lines   | Dimension       | Severity | Finding                                                                                                                                                                                                                          | Suggestion                                                                                                                                                                        | Your verdict |
| ------- | --------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 236-333 | size-complexity | medium   | `periodComparison` is ~98 lines (nearly double the 50-line hard cap), mixing query construction, report aggregation, and row-shaping inline.                                                                                     | Hoist `collect()` to a module-level named function; extract row-building (310-330) into `buildComparisonRows(cellsA, cellsB)`. `periodComparison` should shrink to orchestration. |              |
| 124-196 | size-complexity | medium   | `trafficLightHistory` is ~73 lines, over the 50-line cap, combining where-clause construction, date-label dedup/grouping, and project-map building in one method.                                                                | Extract `reportsByLabel` grouping (169-172) and `projectMap` building (174-184) into named helpers alongside the module's existing pure functions.                                |              |
| 1-334   | size-complexity | low      | File is 334 lines, over the 250-line threshold (250 exactly excluding blanks/comments — marginal). Roughly half (23-118) is generic date/period-comparison logic with no Prisma dependency, co-located with the I/O-bound class. | Move pure helpers (23-118) into a sibling `analytics.period-utils.ts`; separates easily-unit-testable logic from the DB-bound class.                                              |              |
| 17-20   | comments        | low      | 'AUTH-04 (Phase 28-01) parity' ticket/phase reference on the PUBLISHED_FLOOR comment.                                                                                                                                            | Delete the ticket/phase prefix; keep 'mirrors ArchivePrismaRepository.PUBLISHED_FLOOR' in <=1 line.                                                                               |              |
| 23-118  | comments        | low      | All 7 non-exported helper functions (isoDateOnly, startOfUtcDay, nextUtcDay, comparePeriodThenCreated, laterReport, findProjectStatus, statusForProject) carry JSDoc — noise by default on unexported internal helpers.          | Delete narration-style JSDoc; keep at most a 1-line non-obvious WHY where truly needed (e.g. half-open UTC range choice), inline not JSDoc.                                       |              |

Already good: `comparePeriodThenCreated`/`laterReport` give a genuinely non-obvious, correctly deterministic tie-break (periodEnd -> createdAt -> id) reused consistently across all three query methods; the half-open [startOfUtcDay, nextUtcDay) range correctly avoids DST/timezone bugs when matching a date-only label against a timestamp column.

## analytics.service.ts (2 findings)

| Lines             | Dimension | Severity | Finding                                                                                                                                                                                                                                 | Suggestion                                                                                                            | Your verdict |
| ----------------- | --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| 19-27,43-47,52-59 | comments  | medium   | Three JSDoc blocks (9, 5, 8 lines) exceed the 3-line budget carrying load-bearing coordination rationale: group-scope contract on `AnalyticsRepository`, cache-port test-friendliness rationale, `:v2:` cache-key-versioning rationale. | RELOCATE the WHY into an openspec spec/ADR (e.g. 'analytics caching'); leave a <=2-line pointer comment at each site. |              |
| 52                | comments  | low      | 'Phase 32-C / M-04' phase-archaeology reference repeated here.                                                                                                                                                                          | Delete the phase/ticket prefix, same as analytics.cache.ts.                                                           |              |

Already good: clean boundary — every method parses input AND validates output against the shared Zod schema; repository/cache injected as narrow ports (AnalyticsRepository/AnalyticsCachePort) rather than concrete Prisma/Redis types, keeping the service unit-testable without Prisma or Redis.

## analytics.module.ts — clean

## Rollup

By dimension: duplication 1, size-complexity 3, comments 6.

By severity: medium 5, low 5.

Top-3 highest-impact:

1. `analytics.cache.ts` 1-86 — duplication with `telemetry.cache.ts` (medium): a shared `RedisCacheBase` fixes both files at once and removes the largest single chunk of drift risk.
2. `analytics.prisma-repository.ts` 236-333 — `periodComparison` at ~98 lines (medium): furthest over the function-size cap, three concerns tangled in one method.
3. `analytics.service.ts` 19-27,43-47,52-59 — over-budget load-bearing JSDoc (medium): the group-scope contract and cache-versioning rationale are genuinely important but belong in a spec/ADR, not inline.

Openspec overlap — handle in the relevant pending change instead of a generic style sweep:

- **scope-analytics-to-group** — owns the group-scope contract on `AnalyticsRepository`; the `analytics.service.ts` 19-27 JSDoc relocation (finding 5) should land as part of that change's spec work, not a standalone comment trim.
- **fix-analytics-date-matching** — owns the date-matching logic; the `analytics.prisma-repository.ts` pure-helper extraction (finding 4, lines 23-118) and its JSDoc trim (finding 10) should be folded into that change rather than done separately, since it will touch the same functions.
- **tighten-comment-policy** — the general comment-budget violations here (findings 5, 6, 7, 8, 9, 10 — six of ten kept findings) are exactly this change's scope; batch them there rather than fixing analytics in isolation.
- **code-health-and-test-cleanup** / **tighten-code-quality-ratchet** — the size-complexity findings (2, 3, 4) and the cache duplication (1) are generic code-health debt; if either change is in flight, route the fixes through it instead of a one-off analytics PR.

## Killed by verification

- **env-config (high)**: claimed `process.env.REDIS_HOST ?? "localhost"` fallback in `analytics.cache.ts` (and 4 sibling files) lets prod silently connect to localhost instead of failing boot loudly. Refuted — `REDIS_HOST`/`REDIS_PORT` are REQUIRED with no `.default()` in `env.schema.ts`, and `validateEnv()` runs at boot and exits the process on any missing/invalid required var. The fallback is unreachable dead code; the claimed prod failure scenario cannot occur. Residual value is at most a low-severity dead-code cleanup, not the stated high-severity defect.

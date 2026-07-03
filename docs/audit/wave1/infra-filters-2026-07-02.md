# Per-file audit — apps/api/src/infrastructure/filters (2026-07-02)

Read-only audit, wave 1. Scope: 1 file in `apps/api/src/infrastructure/filters`.
Verified findings: 1 kept, 0 killed.
No fixes applied — this is a calibration pass only.

## sentry-exception.filter.ts (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                    | Suggestion                                                                                                                                              | Your verdict |
| ----- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 9     | constants | low      | Magic number `500` used inline for the server-error threshold instead of NestJS's `HttpStatus.INTERNAL_SERVER_ERROR` enum. | Import `HttpStatus` from `@nestjs/common` and write `exception.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR` to make the threshold self-documenting. |              |

Already good: 14 lines total, one method, one responsibility (report 5xx/non-HTTP exceptions to Sentry then delegate to Nest's base filter) — trivially scannable, well under every size/complexity threshold. Zero comments, no narration — self-explanatory, matching the tighten-comment-policy default of NO comment. No mutation/let, single param usage per NestJS's ArgumentsHost contract; sole caller is main.ts's global filter registration — no duplicate exception-filter logic found elsewhere in apps/api/src.

## Rollup

**By dimension:** constants — 1 (low).

**By severity:** low — 1. No medium/high/critical findings.

**Top-3 highest-impact:** only one finding exists — the `500` magic number in `sentry-exception.filter.ts:9`. It is cosmetic (readability only, no correctness risk); no ranking needed beyond it.

**Overlap with pending OpenSpec changes:** none. The single finding is a self-contained constants/readability cleanup with no behavioral surface — it doesn't touch authz, persistence, tenancy, or any area owned by a pending change (checked against `map-domain-errors`, `input-and-error-hardening`, `observability-and-perf-hardening` — none claim this file). Safe to leave as a style-sweep candidate or fix inline whenever this file is next touched.

## Killed by verification

None — the single submitted finding survived verification unchanged.

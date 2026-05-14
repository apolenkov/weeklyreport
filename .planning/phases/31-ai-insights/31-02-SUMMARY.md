# Phase 31-02 — AI-01 Executive Summary — SUMMARY

**Status:** shipped
**Commit:** `20ec3ad`
**Date:** 2026-04-30

## What landed

End-to-end AI-01 feature: head sees an executive summary card above the
assembled weekly report. Card is dismissible per session; head-only
Regenerate button busts the cache and re-runs the Haiku 4.5 call.

## Anthropic SDK

- **Package:** `@anthropic-ai/sdk` newly installed at version `^0.91.1`
- **Pattern:** standard `messages.create` + `tools[]` + forced
  `tool_choice: {type: 'tool', name}` with `input_schema` produced by
  `z.toJSONSchema()` (Zod 4 native).
- **Lazy init:** `getClient()` constructs the client on first call; missing
  `ANTHROPIC_API_KEY` throws `AiUnavailableError` which the service catches
  and returns the unavailable sentinel.

## Prisma migration

- **Name:** `20260430092658_add_ai_insight`
- **Applied:** yes — Postgres reachable on `localhost:5432` at the time of
  this plan; `prisma migrate dev` ran cleanly (no warnings).
- **Schema additions:**
  - `enum AiInsightKind { summary, sentiment, on_track }`
  - `model AiInsight` with `@@unique([kind, contentHash])` (cache key) and
    `@@index([kind, createdAt])` (analytics surface).

## Cache evidence

Unit test `apps/api/src/modules/ai/__tests__/ai.service.test.ts`:

- `cache miss → SDK called → AiInsight upserted`: SDK invoked once;
  `facade.insights.size === 1`.
- `cache hit on second call → SDK NOT called`: SDK invoked exactly once
  across two summary() calls; second result has `cached: true`.
- `regenerateSummary busts cache → SDK called again`: SDK invoked twice
  across `summary()` then `regenerateSummary()`.

## loggingMiddleware exclusion

`apps/api/src/infrastructure/trpc/trpc.middleware.ts` lines 21-30:

```ts
export const loggingMiddleware = t.middleware(async ({ ctx, next, path, type }) => {
  // Phase 31 (AI-SPEC §5.3 / PITFALLS C-3): AI prompts and responses must
  // never reach the structured log stream. Token usage and timing are
  // recorded in AiInsight rows instead.
  if (path.startsWith('ai.')) {
    return next();
  }
  ...
```

## Failure-mode coverage

| Path                                           | Sentinel returned                               |
| ---------------------------------------------- | ----------------------------------------------- |
| Report not found                               | `{available: false, reason: 'not_found'}`       |
| ANTHROPIC_API_KEY missing                      | `{available: false, reason: 'unavailable'}`     |
| SDK throws generic error                       | `{available: false, reason: 'unavailable'}`     |
| RateLimitError                                 | `{available: false, reason: 'rate_limit'}`      |
| Budget exceeded (>50K tokens/h on this report) | `{available: false, reason: 'budget_exceeded'}` |

All five paths covered by unit tests.

## Test counts

| Suite    | Before                                               | After                                | Delta     |
| -------- | ---------------------------------------------------- | ------------------------------------ | --------- |
| api unit | 489 / 41 files                                       | 504 / 43 files                       | +15 / +2  |
| web unit | 228 passing (1 pre-existing fail in `proxy.test.ts`) | 228 passing (same pre-existing fail) | unchanged |

The pre-existing `proxy.test.ts` failure is unrelated — stale assertion
referencing an old proxy.ts shape. Tracked outside this phase.

## Files modified

19 files:

- 8 new: ai-client/cache/facade/service/module + summary prompt + 2 tests
- 1 new: AiSummaryCard
- 1 new: migration SQL
- 6 modified: schema, app.module, main.ts, trpc.middleware, trpc.router,
  weekly-report-page (mount + test mock), session-provider (export
  SessionContext)
- 1 modified: package.json (anthropic dep)
- 1 modified: weekly-report-page.test.tsx (added ai mock)

## Next

`31-03-PLAN.md` adds AI-02 risk sentiment badges, reusing this plan's
ai-client + ai-cache + ai-facade infrastructure.

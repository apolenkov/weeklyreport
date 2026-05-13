# Phase 31-03 — AI-02 Risk Sentiment Badge — SUMMARY

**Status:** shipped
**Commit:** `d9f26cb`
**Date:** 2026-04-30

## What landed

Per-Risk sentiment badge: each risk row in the assembled report now
carries a small `AI · low|medium|high` pill with hover-tooltip rationale.
Hidden when AI is unavailable (does NOT block the row).

## Cache reuse evidence

`apps/api/src/modules/ai/__tests__/ai.service.test.ts`:

- `cache miss → SDK called → row upserted with kind=sentiment`
- `cache hit on second call with identical text → SDK NOT called`
- `two different riskIds with identical text share one cached row`
  — confirms the contentHash is on the `{risk, impact, mitigation}` text
  tuple, not the riskId. Same text reused across reports hits the same
  AiInsight row, exactly as designed.

## Where the badge is mounted

`apps/web/src/components/weekly-report/product-accordion.tsx` line 209
(approx) — appended after the existing severity badge + risk text inside
the risks-and-blockers list. Sized 24×24 max so no layout shift on mobile.

## Failure modes

| Path                    | UI behaviour                                         |
| ----------------------- | ---------------------------------------------------- |
| Loading                 | tiny grey pulsing dot                                |
| Available               | colored pill with `AI · level` and tooltip rationale |
| Unavailable / not_found | `null` (badge hidden) — risk row still renders       |

## Test counts

| Suite    | Before                            | After                                | Delta     |
| -------- | --------------------------------- | ------------------------------------ | --------- |
| api unit | 504 / 43 files                    | 510 / 43 files                       | +6        |
| web unit | 228 passing (1 pre-existing fail) | 228 passing (same pre-existing fail) | unchanged |

## System prompt length

`SENTIMENT_SYSTEM_PROMPT` = 4173 chars (≥3500 floor enforced by unit
test) — qualifies for the Anthropic ≥1024-token cache breakpoint with
`cache_control: 'ephemeral'`.

## Files modified

7 files:

- 2 new: `prompts/sentiment.ts`, `risk-sentiment-badge.tsx`
- 5 modified: `ai.service.ts` (+sentiment method), `trpc.router.ts`
  (+ai.sentiment mount), `ai.service.test.ts` (+sentiment block),
  `product-accordion.tsx` (mount badge), `weekly-report-page.test.tsx`
  (mock ai.sentiment).

## Next

`31-04-PLAN.md` adds AI-03 on-track icon + golden-set eval gate + ESLint
module-isolation rules.

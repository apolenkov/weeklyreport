# Phase 31-04 — AI-03 On-Track Icon + Golden-Set Eval + Module Isolation — SUMMARY

**Status:** shipped (with documented v6.1 follow-up — see below)
**Commit:** `cd21a45`
**Date:** 2026-04-30

## Haiku-only deviation from ROADMAP

ROADMAP success criterion 3 originally suggested **Sonnet 4.6** for AI-03
on-track classification. CONTEXT.md (locked 2026-04-29) overrides this
with **Haiku 4.5** across all three features (AI-01, AI-02, AI-03) per
user pick. This deviation is now formalised in:

- `.planning/phases/31-ai-insights/31-AI-SPEC.md` Section 2
- `.planning/phases/31-ai-insights/31-CONTEXT.md` `<decisions>` block
- The 31-04 commit message body

Cost rationale: ~$0.0005/report effective with Haiku (90% cache hit) vs
~$0.01/report with Sonnet — a 20× difference. Quality trade-off
mitigated by the eval gate (≥80% on-track classification match against
golden-set fixtures).

The deviation is intentional and documented. Reverting to Sonnet for
AI-03 is parked as a deferred v7.0+ knob in CONTEXT.md `<deferred>`
("Sonnet 4.6 escalation for AI-03 on borderline cases").

## Number of golden-set fixtures created

**8 fixtures** at `apps/api/src/modules/ai/__fixtures__/golden-set/`:

| File | Coverage |
|---|---|
| fx-001-all-green.json | All-green stable team |
| fx-002-mixed.json | 4G / 3Y / 1R, modest blockers |
| fx-003-mostly-red.json | Multiple blockers, escalation likely |
| fx-004-missing-section.json | One lead skipped (sick) |
| fx-005-short-text.json | Terse sections |
| fx-006-long-text.json | Verbose narrative |
| fx-007-risks-heavy.json | Many risks across sections |
| fx-008-decisions-heavy.json | Multiple decisions awaiting head |

All synthetic — placeholder names (Acme, Globex, Initech, etc.); no real
client names, no real deal sizes, no real financials. README in the
directory marks the set as `draft, awaiting head sign-off (C-5)`.

## Eval test thresholds

`apps/api/src/modules/ai/__tests__/golden-set.eval.test.ts`:
- **Skip guard:** `describe.skipIf(!process.env['ANTHROPIC_API_KEY'])`
- **Per-fixture timeout:** 60s
- **Pass thresholds (loose — tighten after head review):**
  - ≥80% sentiment-classification match across all golden risks
  - ≥80% on-track-classification match across all golden cells
  - 0 hallucinated counts (no foreign digit-strings in narrative or rationale)
  - summary narrative ≤ 3 sentences
- **Hallucinated-count detection:** input digits collected from
  greenCount/yellowCount/redCount/sectionCount + per-section
  itemCount/riskCount/decisionCount + per-cell counts; output digits
  extracted via `\b\d+\b` regex; any output digit not in the input set
  is recorded as hallucinated.

## ESLint rules added

**Count: 2 rules**, scoped to `apps/api/src/modules/ai/**/*.ts` with
whitelist `[ai-facade.ts, ai-cache.ts, __tests__/**, __fixtures__/**]`:

1. `no-restricted-imports` — bans raw `@prisma/client` import outside
   the facade boundary. Forces all DB access through `ai-facade.ts`.
2. `no-restricted-syntax` — bans `logger.*` calls referencing
   `prompt`, `messages`, or `response` identifiers (PITFALLS C-3 — PII
   in logs).

Verification: `pnpm --filter @customreport/api exec eslint src/modules/ai/`
returns **0 errors** on AI files. (Other parts of the codebase have
pre-existing lint errors unrelated to this phase — confirmed by stashing
and reverting only this commit's diff.)

## test:ai-eval script

```json
"test": "vitest run --exclude '**/*.integration.test.ts' --exclude '**/*.eval.test.ts'",
"test:ai-eval": "vitest run --reporter=verbose src/modules/ai/__tests__/golden-set.eval.test.ts"
```

Regular `pnpm --filter @customreport/api test` no longer picks up the
eval test (so it remains opt-in). Operators run `pnpm test:ai-eval`
with `ANTHROPIC_API_KEY` set to actually exercise live Haiku.

## pnpm lint pass evidence

```
pnpm --filter @customreport/api exec eslint src/modules/ai/
ai.service.test.ts: 0 errors
golden-set.eval.test.ts: 0 errors
ai-client.test.ts: 0 errors
ai.service.ts: 0 errors
ai-client.ts: 0 errors
ai-cache.ts: 0 errors
ai-facade.ts: 0 errors
ai.module.ts: 0 errors
prompts/summary.ts: 0 errors
prompts/sentiment.ts: 0 errors
prompts/on-track.ts: 0 errors
```

The `pnpm lint` workspace-wide command fails because of pre-existing
lint errors in `@customreport/shared` (test-file `no-unused-vars` and
`no-explicit-any` violations dating from earlier phases). These are
unrelated to Phase 31 and tracked outside.

## Test counts

| Suite | Before | After | Delta |
|---|---|---|---|
| api unit | 510 / 43 files | 516 / 43 files | +6 |
| web unit | 228 passing (1 pre-existing fail in proxy.test.ts) | 228 passing (same pre-existing fail) | unchanged |

## UI mount note (deferred to v6.1)

The `<OnTrackIcon sectionId={...} projectId={...} />` component is
fully wired and ready, but is **not yet mounted inline** in the
existing weekly-report page. Reason: the current ProductReport view
shape uses synthetic string ids (e.g. `'polenkov'`, `'maria'`) rather
than the UUIDs the tRPC procedure expects. Threading real
`reportSectionId` / `projectId` UUIDs through the existing dashboard
mapper layer is a refactor that exceeds this plan's atomic-commit
budget.

The deliverables that DID land:
- `ai.onTrack` tRPC procedure (callable from any client now)
- `OnTrackIcon` client component (importable, tested via type
  inference)
- Per-cell contentHash + cache + sentinel guarantees (parity with
  AI-01/02)
- Golden-set fixtures + eval test exercising AI-03 end-to-end

The UI mount lands in a v6.1 follow-up plan that refactors the
weekly-report mapper to thread real UUIDs (and at that point we'll
also resolve the v6.1 head sign-off on golden-set thresholds).

## Files modified

17 files in this commit:
- 1 new prompt: `prompts/on-track.ts`
- 1 new component: `on-track-icon.tsx`
- 8 new fixtures in `__fixtures__/golden-set/` + README
- 1 new eval test: `golden-set.eval.test.ts`
- 4 modified: `ai.service.ts` (+onTrack method), `trpc.router.ts`
  (+ai.onTrack mount), `ai.service.test.ts` (+onTrack block),
  `eslint.config.ts` (+module-isolation block)
- 1 modified: `apps/api/package.json` (test:ai-eval script + exclude
  from default test).

## Next

Phase 31 complete pending head sign-off on golden-set rubric (C-5
deferred per CONTEXT.md). The deferred v6.1 follow-up plan should:
1. Refactor weekly-report mapper to thread reportSectionId/projectId
   UUIDs.
2. Mount `<OnTrackIcon>` adjacent to the lead's traffic-light colour
   in `product-accordion.tsx`.
3. After head review of golden-set, tighten eval thresholds in
   `golden-set.eval.test.ts`.

# Phase 31: AI Insights - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (workflow.skip_discuss=true)
**User constraint:** Haiku 4.5 ONLY for cheapest cost (deviation from ROADMAP success criterion 3 which suggested Sonnet for on-track icon — see decisions)

<domain>
## Phase Boundary

Wave 5 / final v6.0: heads get 2-3 sentence executive summary, every risk row carries sentiment badge, lead traffic-light cells show on-track advisory icon. AI never overwrites human content or changes chosen colours.

**In scope (3 REQ-IDs):**

- AI-01: Executive summary (2-3 sentences) above head's narrative textarea, dismissible, head-only Regenerate button. Haiku 4.5 + betaZodTool + cached on contentHash.
- AI-02: Sentiment badge per Risk row (low/medium/high) — Haiku 4.5 + structured Zod tool output. Cached per Risk content hash. AiInsight Prisma row records `usage.{input,output,cache_creation,cache_read}_tokens`.
- AI-03: On-track advisory icon (✓/⚠/✗) alongside lead's traffic light — Haiku 4.5 (user pick — deviation from ROADMAP suggesting Sonnet 4.6) with pre-computed counts in system prompt under `DO NOT change these numbers`. Eval-step CI threshold against 8-12 report golden-set.

**Out of scope:**

- RAG / vector search (user explicitly excluded)
- Multi-document grounding (one report at a time)
- Long-term memory of leads
- AI-edited content (read-only insights, never overwrite)

</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- **Anthropic SDK direct** (no LangChain, no Vercel AI SDK — per StackResearch)
- **Haiku 4.5 for ALL three features** (AI-01, AI-02, AI-03) — user picked cheapest. ROADMAP suggested Sonnet for AI-03 but per-render cost ($0.001 vs $0.01) wins. Quality trade-off acknowledged; eval rubric will catch regressions.
- **No Opus 4.7 anywhere** (5× cost, marginal lift per StackResearch)
- **Read-through cache on contentHash** (C-1: per-render cost runaway mandatory mitigation) — `contentHash = sha256(JSON.stringify(content))`. Prisma table `AiInsight` stores result by contentHash.
- **Pre-compute counts in prompt** (C-2: LLM hallucinated counts) — system prompt includes `DO NOT change these numbers` directive with exact counts injected.
- **Anthropic prompt caching ≥1024 tokens** — system rubric ≥1024 tokens to qualify; cache_creation_tokens reduce per-call cost ×10 on repeat.
- **Anthropic data-retention OFF** (success criterion 4) — verified at workspace level, documented in AI-SPEC.

### Module Isolation (success criterion 4)

- All AI code in `apps/api/src/modules/ai/**`
- ESLint `no-restricted-imports` blocks raw `@prisma/client` in ai/\*\*; ai module accesses DB only via internal facades
- Logging middleware excludes `ai.*` tRPC procedures (no prompt/response in logs)
- Lint rule bans `logger.*` of `prompt` / `messages` / `response.content` in ai/\*\*

### Eval Strategy (AI-03 gate)

- 8-12 report golden-set fixtures committed at `apps/api/src/modules/ai/__fixtures__/golden-set/`
- Each fixture: full report JSON + expected outputs (summary, per-risk sentiment, per-cell on-track verdict)
- Eval test in `apps/api/src/modules/ai/__tests__/golden-set.eval.test.ts` runs against live Haiku API (skipped in CI by default; runs on-demand via `pnpm test:ai-eval`)
- Pass threshold: ≥80% match on sentiment + on-track classifications; summary checked for: (a) ≤3 sentences, (b) no hallucinated counts, (c) human-content not paraphrased verbatim
- Head sign-off on golden-set deferred (currently in v6.0 STATE.md as blocker C-5) — AI-SPEC marks fixtures as "draft, awaiting head sign-off"

### Phase Sequencing (suggested 4-plan split)

- 31-01 — AI-SPEC.md (the design contract — produced as part of this phase, not a separate ceremony)
- 31-02 — AI-01 executive summary feature (Haiku + betaZodTool + AiInsight Prisma table + cached procedure + RSC card UI)
- 31-03 — AI-02 risk sentiment badge (Haiku + Zod tool output + per-Risk cache + RSC badge UI)
- 31-04 — AI-03 on-track icon + golden-set eval CI gate (Haiku + pre-computed counts + 8-12 fixtures + eval test + lint rules for module isolation)

</decisions>

<code_context>

## Existing Code Insights

### Reusable Assets

- `packages/shared/src/schemas/` — Zod schemas pattern; AI tool outputs follow same convention
- `apps/api/src/infrastructure/trpc/trpc.middleware.ts` — viewerProcedure / headProcedure for AI procedures (read-only access, head-only Regenerate)
- `apps/web/src/components/charts/` — RSC + lazy-import client boundary pattern from Phase 30 (mirror for AI badge components)
- Phase 28-04 CHECKLIST.md already has placeholder line `pnpm test:ai-eval` — Phase 31 fills it in

### Established Patterns

- Anthropic SDK: `@anthropic-ai/sdk` (already in stack research; install via pnpm)
- contentHash: `crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')`
- Zod tool: `betaZodTool({ name, description, schema, ... })` from anthropic v0.90+

### Integration Points

- AI-01 card lives at top of `apps/web/src/app/(app)/head/report/[reportId]/page.tsx` (or wherever assembled report renders)
- AI-02 badges integrate with existing risk-row component
- AI-03 icons overlay traffic-light cells in lead/head views
- AiInsight Prisma table is new — migration in 31-02

</code_context>

<specifics>
## Specific Ideas

- **AI-SPEC.md path:** `.planning/phases/31-ai-insights/31-AI-SPEC.md` (single design-contract file; not 4 separate research files)
- **AiInsight Prisma model fields:** `id`, `kind` ('summary' | 'sentiment' | 'on-track'), `contentHash`, `result Json`, `inputTokens`, `outputTokens`, `cacheCreationTokens`, `cacheReadTokens`, `createdAt` — covers cost tracking + cache key
- **Cost projection (Haiku 4.5):** input ~$0.0008/1K, output ~$0.004/1K. Per-report: ~5K input + 200 output ≈ $0.005. With 90% cache hit → effective $0.0005/report. 100 reports/week × 4 weeks ≈ $0.20/month. Negligible.
- **Failure modes:**
  - Anthropic API outage → AI features degrade gracefully (UI shows "AI unavailable", not error)
  - Rate limit → BullMQ retry with exponential backoff
  - Hallucinated count → caught by eval test against golden-set
  - Cost runaway → contentHash cache + per-report budget guard (max $0.05/report; abort if exceeded)

</specifics>

<deferred>
## Deferred Ideas

- Head sign-off on golden-set rubric (C-5 in STATE.md blockers) — AI-SPEC ships with draft fixtures; CI threshold loose until head approves
- Multi-language summary (RU + EN) — v6.0 EN-only; localization in v7.0
- Streaming summary UI — v6.0 ships fully-rendered summary card
- Sentiment override by head — read-only insights for v6.0; manual override in v7.0
- Sonnet 4.6 escalation for AI-03 on borderline cases — future cost/quality knob

</deferred>

---
phase: 54
plan: ai-rag-seeds
subsystem: ai/rag
mode: seeds-only
ufb: UFB-055
tags: [ai, rag, scaffolding, adapter, mock, schema, trpc, web]
status: complete
dependency-graph:
  requires: [50-period-lifecycle, 52-telemetry]
  provides: [ai-adapter-port, ai-ingestion-job-queue, period-summary-trpc, ai-summary-ui-tab]
  affects: [PublicationService, PeriodService, /reports/[reportId]]
tech-stack:
  added: []
  patterns: [pluggable-adapter-port, fire-and-forget-ingestion, redis-cache-degrade]
key-files:
  created:
    - prisma/migrations/20260510231145_ai_ingestion_job_stub/migration.sql
    - apps/api/src/modules/ai/ai.adapter.ts
    - apps/api/src/modules/ai/mock-ai.adapter.ts
    - apps/api/src/modules/ai/ai-summary.cache.ts
    - apps/api/src/modules/ai/ai-summary.service.ts
    - apps/api/src/modules/ai/ai-summary.prisma-repository.ts
    - apps/api/src/modules/ai/ai-ingestion.service.ts
    - apps/api/src/modules/ai/__tests__/mock-ai.adapter.test.ts
    - apps/api/src/modules/ai/__tests__/ai-summary.service.test.ts
    - packages/shared/src/schemas/ai-summary.ts
    - packages/shared/src/schemas/__tests__/ai-summary.test.ts
    - apps/web/src/components/ai/period-summary-tabs.tsx
    - apps/web/src/components/ai/period-summary-tabs.test.tsx
  modified:
    - prisma/schema.prisma
    - apps/api/src/modules/ai/ai.module.ts
    - apps/api/src/modules/publication/publication.service.ts
    - apps/api/src/modules/publication/publication.module.ts
    - apps/api/src/modules/period/period.service.ts
    - apps/api/src/modules/period/period.module.ts
    - apps/api/src/modules/period/period.prisma-repository.ts
    - apps/api/src/infrastructure/trpc/trpc.router.ts
    - apps/api/src/main.ts
    - packages/shared/src/index.ts
    - "apps/web/src/app/(app)/reports/[reportId]/page.tsx"
decisions:
  - Naming: tRPC procedure is `ai.periodSummary({ periodId })`, NOT
    `ai.summary({ periodId })` — the latter is already shipped Phase 31/32
    surface taking `{ reportId }`. Renamed sibling preserves both.
  - Adapter selection: `AI_PROVIDER` env at module boot; "mock"/unset →
    MockAiAdapter; anything else throws — fail loud over silent fallback.
  - Ingestion: fire-and-forget — publish path never breaks on RAG infra
    blips. Errors logged via AppLogger or swallowed by hook wrappers.
  - No `onDelete` cascade on AiInsight (existing Phase 31/32), but
    `AiIngestionJob → ReportSection` IS Cascade. Orphan jobs would be
    unprocessable (source text gone) so clean death is the right semantic.
  - No unique constraint on `reportSectionId` in AiIngestionJob —
    reopen+republish enqueues a fresh row; worker dedupes by content hash.
metrics:
  duration: ~45min
  completed: 2026-05-11
  tasks: 6 (+ 1 inline DI fix)
  commits: 7
  files-created: 13
  files-modified: 11
  test-deltas:
    api: 859 → 871 (+12)
    web: 348 → 354 (+6)
    shared: 533 → 540 (+7)
---

# Phase 54: AI / RAG Integration — Seeds-Only Summary

Per user decision 2026-05-11 («без LLM без real config = броски в пустоту,
пока просто заделы с TODO»), this phase lands ONLY the scaffolding for a
future RAG + period-summary pipeline. No LLM call, no embedding, no
Qdrant/pgvector dependency. The cutover to a real provider is a code
change in one factory (`selectAiAdapter`) and a new adapter file —
not a data-model change, not an API contract change, not a UI change.

## What was built

### Database layer

```
┌─ AiIngestionJob ──────────────────────────────────┐
│ id              uuid pk                            │
│ reportSectionId text fk → ReportSection (cascade)  │
│ status          text default 'pending'             │
│ attempts        int  default 0                     │
│ lastError       text? null                         │
│ createdAt       timestamp default now()            │
│ processedAt     timestamp? null                    │
│ idx (status, createdAt) + (reportSectionId)        │
└────────────────────────────────────────────────────┘
```

State machine: `pending → processed | failed | skipped`. Idempotency
is intentionally NOT enforced at the DB layer — reopen+republish
enqueues a fresh row, the future worker dedupes by content hash.

Migration `20260510231145_ai_ingestion_job_stub` is additive only;
no column drops, idempotent.

### API layer

```
[publish path]                 [tRPC]                  [adapter]
PublicationService ──┐     ai.periodSummary ── AiSummaryService ──┐
PeriodService ───────┤              ↓                              │
                     │       AiSummaryCache (Redis 60s)            │
                     ▼              ↓                              ▼
              AiIngestionService → AiSummaryRepository       AiAdapter (port)
              (fire-and-forget)    (Prisma)                         │
                     ▼                                              ▼
              AiIngestionJob rows                          MockAiAdapter
              (worker eats later)                          (deterministic stub)
                                                                    │
                                                  env: AI_PROVIDER=mock|unset
                                                  any other value → throw at boot
```

Three new injectable units:

- **`AiAdapter` interface + DI token `AI_ADAPTER`** — the seam every
  future LLM provider must satisfy. `generate(prompt, context):
Promise<string>`.
- **`MockAiAdapter`** — emits the sentinel
  `[mock-summary] N sections, period <id>`. Deterministic. Ignores
  the prompt by design so test fixtures cannot rely on its body.
- **`AiSummaryService`** — period → repo → adapter, wrapped in a 60s
  Redis cache (`customreport:ai:summary:<periodId>:v1`). Returns the
  shared `aiSummarySchema` shape: `{ summary, source, citationIds }`.
- **`AiIngestionService`** — fire-and-forget `createMany` on
  `AiIngestionJob`. Errors logged, never thrown. Wired into both
  `PublicationService.publishReport` / `publishAuto` and
  `PeriodService.publishPeriod`.

### tRPC surface

```
ai.periodSummary({ periodId: uuid })
  authz:   leadershipProcedure (head + admin + viewer; lead excluded)
  cache:   60s Redis
  shape:   aiSummarySchema = { summary, source: 'mock'|'ai', citationIds: uuid[] }
  fixture: createAppRouter({}) returns empty mock payload (role-coverage harness)
```

### Shared schemas

```
aiSummarySchema = z.object({
  summary:      z.string(),
  source:       z.enum(['mock', 'ai']),
  citationIds:  z.array(z.string().uuid()),
});
```

Forward-compatible: backend flips `source` to `'ai'` once a real
provider is wired, no contract bump.

### Web UI

```
/reports/<reportId>
└── <PeriodSummaryTabs periodId=<reportId>>
    ├── Tab «Report»      ← default; renders <WeeklyReportPage> (passthrough)
    └── Tab «AI Summary»  ← calls ai.periodSummary
        ├── loading       «Загружаем AI summary…»
        ├── error         «AI summary недоступен.»
        ├── empty (mock)  «Нет опубликованных секций для саммари» + (заглушка) Badge
        └── populated     prose + (заглушка) Badge (only when source==='mock')
```

The «(заглушка)» badge auto-hides when `source === 'ai'` — i.e. the
moment the org wires a real provider, the same UI stops claiming to
be a stub. No future code change needed.

## Commits (chronological)

| #   | Hash    | Scope  | Summary                                                       |
| --- | ------- | ------ | ------------------------------------------------------------- |
| 1   | 27adf21 | schema | AiIngestionJob stub table (54-1)                              |
| 2   | e4a49a0 | api    | AiAdapter port + MockAiAdapter + summary service (54-2)       |
| 3   | 95df655 | api    | Wire AiIngestionService into publish paths (54-3)             |
| 4   | 157f891 | shared | aiSummarySchema (54-4)                                        |
| 5   | 988c08e | api    | ai.periodSummary tRPC procedure (54-5)                        |
| 6   | c271594 | web    | AI Summary tab on /reports/<id> (54-6)                        |
| 7   | 6a0aafc | api    | DI shape fix on AiIngestionService (Nest provider resolution) |

## Test counts

```
┌─ deltas ──────────────────────┐
│ api    859 → 871   (+12)      │
│ web    348 → 354   (+6)       │
│ shared 533 → 540   (+7)       │
│ tsc    api ✓  web ✓  (both 0) │
└───────────────────────────────┘
```

Migration applied locally + in the api container; container restart
healthy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Renamed tRPC procedure to avoid collision**

- **Found during:** Task 5 (tRPC wiring)
- **Issue:** Spec asked for `ai.summary({ periodId })`. The codebase
  already ships `ai.summary({ reportId })` from Phase 31/32 (real
  Anthropic SDK call + AiInsight cache + per-report budget guard).
  Reusing the name would either overwrite working production code or
  introduce an overload that breaks the existing tRPC client type.
- **Fix:** Procedure renamed to `ai.periodSummary({ periodId })`.
  Zod schema name `aiSummarySchema` kept as-is (the schema is the
  new concept). Backend code kept clean: `AiSummaryService` for the
  new Phase 54 surface vs `AiService` for the Phase 31 surface.
- **Files modified:** `apps/api/src/infrastructure/trpc/trpc.router.ts`,
  `apps/web/src/components/ai/period-summary-tabs.tsx`
- **Commits:** 988c08e, c271594

**2. [Rule 1 — DI bug] AiIngestionService constructor shape**

- **Found during:** Post-Task 6 container restart
- **Issue:** Initial `AiIngestionService` constructor used
  `(prisma, logger?: AppLogger)`. Nest's DI graph tried to resolve
  the optional logger as a provider and failed at boot —
  `AppLogger` is built in `main.ts`, not registered as a Nest token.
- **Fix:** Logger moved to a class-field default + `withLogger`
  test-only setter. Constructor is now `(prisma)` only — same
  external contract, no provider resolution surprise.
- **Files modified:** `apps/api/src/modules/ai/ai-ingestion.service.ts`
- **Commit:** 6a0aafc

### Naming choices not in spec

- **Adapter file split:** Spec listed
  `apps/api/src/modules/ai/{ai.adapter.ts,mock-ai.adapter.ts}`. Added
  one extra: `ai-summary.service.ts` + `ai-summary.cache.ts` +
  `ai-summary.prisma-repository.ts` (split for testability — service
  has no Prisma dep, can be unit-tested without DB).
- **Test files:** Added 25 new tests across api/web/shared. Spec
  required only «add tests for aiSummarySchema» (7 there); the
  remaining 18 cover the new adapter, service, and UI tab behaviour.

## What was NOT built (intentional)

- ❌ Real LLM provider — no Claude / GPT / YandexGPT / Llama wiring
- ❌ Embedding pipeline — no Qdrant, no pgvector
- ❌ Worker that drains `AiIngestionJob` — rows just accumulate
- ❌ Retrieval/RAG logic — `citationIds` is currently the full
  section-id list, not a grounded subset
- ❌ Cost/budget guard for the new path — Phase 31's
  `AiService.isOverBudget` is per-report and unrelated; a new guard
  lands when a real provider does
- ❌ Telegram integration — explicitly delegated to Phase 55

The follow-on phase that wires a real provider needs to: pick the
provider, set the `AI_PROVIDER` env, add a new adapter file
(`anthropic-rag.adapter.ts` / etc.), extend `selectAiAdapter()`, and
add a worker for `AiIngestionJob`. Nothing in this phase blocks any
of that.

## Open questions for the follow-on phase

1. **Provider selection** — Claude / GPT-4 / YandexGPT / on-prem Llama.
   User decision deferred per the original CONTEXT.md.
2. **Worker scheduling** — BullMQ recurring job vs cron tick? Probably
   BullMQ to mirror Phase 29 reminders pattern.
3. **Embedding storage** — pgvector inside the existing Postgres vs
   external Qdrant. pgvector is one extension install + a new column,
   Qdrant adds a service. Pick once latency budget is known.
4. **Token budget** — period-summary calls are bounded (N sections per
   period × ~6 leads × 50 weeks ≈ a few thousand calls/year). Even at
   Haiku rates this is sub-$100/year. A real per-request cap can wait.
5. **Citations** — the `citationIds` field is currently the full
   section-id list. Real retrieval will narrow it; UI is already
   pluralisation-correct so no UI change needed.

## Self-Check: PASSED

Files verified on disk:

- `prisma/migrations/20260510231145_ai_ingestion_job_stub/migration.sql` — FOUND
- `apps/api/src/modules/ai/ai.adapter.ts` — FOUND
- `apps/api/src/modules/ai/mock-ai.adapter.ts` — FOUND
- `apps/api/src/modules/ai/ai-summary.service.ts` — FOUND
- `apps/api/src/modules/ai/ai-summary.cache.ts` — FOUND
- `apps/api/src/modules/ai/ai-summary.prisma-repository.ts` — FOUND
- `apps/api/src/modules/ai/ai-ingestion.service.ts` — FOUND
- `packages/shared/src/schemas/ai-summary.ts` — FOUND
- `apps/web/src/components/ai/period-summary-tabs.tsx` — FOUND

Commits verified in `git log`:

- 27adf21, e4a49a0, 95df655, 157f891, 988c08e, c271594, 6a0aafc — all FOUND

Verification gates:

- `pnpm --filter @customreport/api test --run` → 871 passed (was 859)
- `pnpm --filter @customreport/web test --run` → 354 passed (was 348)
- `pnpm --filter @customreport/shared test --run` → 540 passed (was 533)
- `pnpm --filter @customreport/api exec tsc --noEmit` → exit 0
- `pnpm --filter @customreport/web exec tsc --noEmit` → exit 0
- Migration applied + Prisma client regenerated in api container
- `customreport-api-1` healthy after restart

## Activation Playbook (W3.3 — 2026-05-11)

When the org picks an AI provider, activate Phase 54 as follows:

### 1. Environment variables

Set in `.env` / deployment secret store:

```
AI_PROVIDER=anthropic   # or: openai | yandexgpt | llama
ANTHROPIC_API_KEY=sk-...  # for anthropic provider
```

### 2. Implement real adapter

Create `apps/api/src/modules/ai/<provider>-ai.adapter.ts` implementing `AiAdapter`:

```ts
export class AnthropicAiAdapter implements AiAdapter {
  async generate(prompt: string, context: AiAdapterContext): Promise<string> { ... }
}
```

Wire it in `selectAiAdapter()` (`apps/api/src/modules/ai/ai.module.ts`):

```ts
if (provider === "anthropic") return new AnthropicAiAdapter();
```

### 3. Flip activation integration test

Run `apps/api/src/modules/ai/__tests__/activation.integration.test.ts` with
`AI_PROVIDER=anthropic ANTHROPIC_API_KEY=<key>`. All tests should pass (they
were previously skipped).

```bash
AI_PROVIDER=anthropic ANTHROPIC_API_KEY=<key> \
  pnpm --filter @customreport/api test --run activation.integration
```

### 4. Smoke test

```bash
# Check Prometheus counter is incrementing
curl -s http://localhost:3002/metrics | grep customreport_ai_summary_generated_total

# Call the tRPC endpoint directly
curl -s "http://localhost:3002/trpc/ai.periodSummary?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22periodId%22%3A%22<uuid>%22%7D%7D%7D"
```

Expect `source: "ai"` in the response (not `"mock"`).

### 5. Metrics to monitor

- `customreport_ai_summary_generated_total{provider, status}` — should tick with `provider="anthropic", status="ok"`
- `customreport_ai_summary_duration_seconds{provider}` — p99 < 5s target

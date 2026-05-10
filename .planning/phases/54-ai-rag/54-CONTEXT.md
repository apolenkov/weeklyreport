# Phase 54: AI Integration & RAG (SEEDS + TODO)

**Status:** seeds-only (2026-05-11 user decision). Land schema + adapter
interface + placeholder UI; do NOT wire real LLM provider until org picks
one.
**User decision (2026-05-11):**

- Hosting: **on-prem** (no public-cloud LLM calls without explicit re-decision)
- LLM choice: **defer** — adapter abstraction lets the actual model swap
  later. «API решит всё равно что» — pluggable per environment variable.
- Rationale: «без LLM без real config = броски в пустоту, пока просто
  заделы с TODO».
  **Scope reduction for this round:**
- Create `AiAdapter` interface (`generate(prompt, context): string`)
- Implement `MockAiAdapter` returning hardcoded summary for dev/test
- Wire ingestion stub: on Report.publish event, log to `AiIngestionJob`
  table (rows for later batch processing); NO embedding call yet
- UI: «AI Summary» tab in `/reports/<id>` rendering the mock output
  with a clear «(заглушка)» badge
- All real LLM logic (embedding, retrieval, prompt-engineering) behind
  `if (env.AI_PROVIDER === 'mock') return mock` — leave the else branch
  as `throw new Error('AI provider not configured')` until org decides.

**Driver:** «будущая интеграция с ИИ... RAG и по группам и лидами к ним... RAG будет и в Telegram и summary» (2026-05-10 in-chat capture)
**Drivers (combined ideas):**

- AI-generated weekly summaries per department / per group
- RAG (Retrieval-Augmented Generation) chat: ask «расскажи как дела у группы X в последние 3 недели» → context retrieved from report sections, LLM answers
- Per-lead context for AI («что обещал Василий И. на прошлой неделе и сдал ли?»)
- Auto-summary delivered to Telegram (see Phase 55)

## Scope (idea-level)

- **Ingestion pipeline**: every published ReportSection vectorized
  (embeddings) and stored in pgvector / Qdrant / Pinecone
- **Retrieval**: by group, by lead, by date-range, by topic
- **Generation**: LLM (Claude / GPT-4 / YandexGPT) writes the summary
  with citations back to source sections
- **Eval framework**: dimension scoring (faithfulness, relevance,
  conciseness, no-hallucination), reference dataset of 50-100 known
  Q&A pairs from real reports
- **Cost guards**: token budget per request, fallback to cheaper model
  for non-critical queries
- **Privacy**: data classification (which sections can leave the org
  perimeter for cloud LLM); on-prem inference fallback if needed

## Likely shape

| Plan | Scope                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 54-A | Framework selection (LangChain vs Llamaindex vs custom; pgvector vs Qdrant) — use `/gsd-framework-selector` |
| 54-B | Ingestion pipeline (embed on publish event, BullMQ job)                                                     |
| 54-C | Retrieval surface (tRPC `ai.search`, `ai.summary`, `ai.askAbout`)                                           |
| 54-D | Generation prompts + few-shot examples + eval rubric                                                        |
| 54-E | UI surface (head dashboard «AI insights» panel + chat)                                                      |
| 54-F | Evaluation harness (`/gsd-eval-review` style)                                                               |
| 54-G | Telegram bot integration (delegated to Phase 55)                                                            |

## Use /gsd-ai-integration-phase

This phase fits the dedicated AI-integration workflow:

```bash
/gsd-ai-integration-phase 54
```

Produces an AI-SPEC.md with framework selection, domain research,
eval plan, guardrails.

## Dependencies

- Phase 50/51 (period lifecycle stable — predictable publish events
  to feed the ingestion pipeline)
- Phase 53 (cloud — many LLM calls don't run on-prem; need outbound
  egress + token billing)
- Phase 55 (Telegram — one of the consumption surfaces)

## Open questions for /gsd-discuss-phase

- LLM choice (Claude API / OpenAI / YandexGPT / on-prem Llama)
- Data classification: can report content leave the perimeter?
- Latency target (synchronous chat vs async batch summary)
- Per-user RAG vs per-group RAG (privacy boundary)
- Budget for tokens/month

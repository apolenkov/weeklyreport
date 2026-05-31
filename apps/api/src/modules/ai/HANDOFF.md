# AI Module — Handoff for Rearchitecture

**Status as of 2026-05-30.** This module is a **deferred, mock-only scaffold**.
It is hidden from users behind a "coming soon" UI and runs no real LLM in any
environment. It is meant to be **rebuilt from scratch architecturally** by its
next owner. Treat the current code as _reference, not constraint_.

---

## TL;DR for the new owner

- Nothing here is live. `AI_PROVIDER` defaults to `mock`; any real value throws
  `Not implemented — see TODO(Phase-54-activation)` at boot (see
  `selectAiAdapter()` in `ai.module.ts`).
- Users never see it: the UI shows `agent-review-coming-soon.tsx`.
- You are free to redesign provider selection, the data seam, the safety
  contracts, and the DB shape. The maintainer has explicitly opened the safety
  contracts for re-decision (see "Open decisions").
- Land your rebuild as an OpenSpec change (proposal → design → specs → tasks).

## What exists today

Two seams under one module:

- **Phase 31/32 `AiService`** — facade-based (`ai-facade.ts` →
  `AiPrismaFacade`). The original insight seam.
- **Phase 54 `AiSummaryService`** — RAG / period-summary seam with a cache
  (`ai-summary.cache.ts`, Redis-backed + a `NullAiSummaryCache` for tests) and a
  Prisma repository (`ai-summary.prisma-repository.ts`).

Adapter layer: `ai.adapter.ts` (port `AI_ADAPTER`), `mock-ai.adapter.ts` (the
only wired adapter), `ai-client.ts` (lazily builds a real Anthropic client from
`ANTHROPIC_API_KEY` — partial real-provider scaffolding, not active).

~25 files total incl. tests, an eval (`golden-set.eval.test.ts`), fixtures, and
prompts (`prompts/`, `prompts.sanitize.test.ts`).

## Wiring / blast radius (what removing or rebuilding touches)

- **App boot**: `apps/api/src/app.module.ts` imports and registers `AiModule`
  (≈L16, L63).
- **API**: `apps/api/src/infrastructure/trpc/trpc.router.ts` imports
  `AiService`, `ai-authz`, `AiSummaryService` → tRPC routes depend on it.
- **Database** (`prisma/schema.prisma`): models `AiIngestionJob` (≈L607),
  `AiInsight` (≈L621), enum `AiInsightKind` (≈L748), and an `aiIngestionJobs`
  relation (≈L253). **Migrations are append-only** — dropping these is a
  destructive migration gated by `prisma/_destructive-guard.ts` (in MVP,
  `migrate reset` is preferred over alter-table; state that in the change).
- **UI**: `apps/web/src/components/report-shell/agent-review-coming-soon.tsx`.
- **Env switches**: `AI_PROVIDER` (adapter selection), `ANTHROPIC_API_KEY`
  (real client).

## Current safety contracts — the durable invariant (all up for re-decision)

The spec `openspec/specs/ai-module-facade/spec.md` asserts four requirements.
The next owner should treat these as the _current_ design intent, not fixed law:

1. **Facade — no direct Prisma in the AI module.** Enforced by a **Biome**
   `noRestrictedImports` override scoped to `apps/api/src/modules/ai/**`
   (exemptions: `ai-facade.ts`, `ai-cache.ts`, `ai-authz.ts`, tests, fixtures).
   ⚠️ **The maintainer has flagged this ban for removal** — they want AI code to
   read the DB directly. Re-decide as part of the rebuild.
2. **Token-budget guard** — 50 000 tokens/hour/user, Redis counter (1h TTL),
   reject with `AiBudgetExceededError`, no silent truncation.
3. **Sanitize layer** — 8 redact patterns; a branded `SanitizedPayload` type is
   meant to make sending an unsanitized string to the provider a _compile-time_
   error. **This is the real PII-to-LLM gate** (independent of the import ban).
   **Verify it is actually implemented, not only specced**, before relying on it
   — and before relaxing the import ban.
4. **Provider errors contained** — translate 429 / timeout / content-policy into
   domain errors; never leak raw provider bodies to tRPC or the client.

> Doc drift to fix on the way past: the spec text says the import ban is an
> **ESLint** rule. It moved to **Biome** in `4d7ad5e7`. Correct this when you
> touch the spec.

## Open decisions for the new owner

- **Provider**: none chosen, none budgeted. Candidates noted in code:
  `anthropic | openai | yandexgpt | llama`. Each is meant to land in its own
  adapter file (`anthropic-ai.adapter.ts`, …) behind `selectAiAdapter()`.
- **Keep the facade / Prisma-ban, or let AI read the DB directly?** Maintainer
  leans toward removing the ban; the sanitize-at-send gate (contract 3) is the
  control that actually matters and can stand on its own.
- **Merge the two seams?** `AiService` (Phase 31/32) vs `AiSummaryService`
  (Phase 54) currently coexist; a from-scratch design may unify them.
- **DB models** — keep / extend / drop (mind append-only + the destructive
  guard).
- **Planning context**: `.planning/phases/54-ai-rag/54-PHASE-SUMMARY.md` is
  referenced in code but `.planning/` was removed during the Biome migration
  (`4d7ad5e7`). Recover it via `git log -- .planning/phases/54-ai-rag/` if you
  need the original Phase-54 open-questions.

## Suggested first steps

1. Read the four spec requirements above and skim the module files.
2. Confirm the sanitize branded-type gate (contract 3) is real in code.
3. Decide provider + target architecture from scratch.
4. Write an OpenSpec change (`openspec new change rearchitect-ai-module`) with
   proposal/design/specs/tasks; supersede or rewrite `ai-module-facade` there.

## Superseded deferred changes (folded into this brief)

Three `openspec/deferred/` entries described future AI work against the now-deleted
scaffold. They referenced concrete deleted file:line anchors (e.g.
`ai.module.ts:29`, `ai-summary.service.ts:78`) and are removed as part of the AI
backend removal; their intent lives on here so nothing is lost:

- **activate-ai-provider** — pick + wire a real provider
  (anthropic / openai / yandexgpt / llama) with budget. See "Open decisions →
  Provider" and the `selectAiAdapter()` per-adapter-file pattern above.
- **wire-agent-review** — replace the `agent-review-coming-soon.tsx` placeholder
  with a real review surface (was scoped to "Phase 60", behind a
  `FEATURE_AGENT_REVIEW` flag). The coming-soon UI + its `TODO(AGENT-REVIEW-01)`
  trace are intentionally kept; the backend is part of the rebuild.
- **polish-ai-summary-visuals** — visual polish of the AI summary card; moot until
  the card is re-introduced by the rebuild.

# Tasks

NOT STARTED — captured 2026-06-10.

## Provider decision + adapter port

- **AI-T1** Pick AI provider (Anthropic / YandexGPT / Llama) and embedding
  model; record the choice in the activated change's design
- **AI-T2** Implement `apps/api/src/modules/ai/ai.adapter.ts` with an
  `AI_ADAPTER` injection token, mirroring the `TELEGRAM_ADAPTER` port pattern
  (`apps/api/src/modules/telegram/telegram.adapter.ts:43`)
- **AI-T3** Add provider credentials and feature env to `.env.example`
  (e.g. `AI_PROVIDER`, provider API key); never inline secrets

## RAG ingestion + read path

- **AI-T4** Implement the RAG ingestion consumer behind `IngestionPublishHook`
  (`apps/api/src/modules/publication/publication.service.ts:23`); embed
  published section content into a vector corpus on every successful publish
- **AI-T5** Implement the summary / extract-risk read procedure over the corpus
- **AI-T6** Replace the inert "AI Summary" placeholder
  (`apps/web/src/components/admin/settings-integrations-sub-tab.tsx:150`)
  with a real provider/corpus status; remove the to-be-planted
  `TODO(activate-ai-rag-provider)` marker (to-be-planted, not live) and
  the `ComingSoonBadge` per deferred-feature-pattern
- **AI-T7** Add integration test for ingestion-on-publish and the summary read
  path (mock provider HTTP)

## Gates + verification + acceptance

- **AI-T8** Update `settings-tab.test.tsx` expectations for the activated card
  (the current test asserts `integration-ai-provider` = "not configured" and
  `integration-ai-rag` = "empty" at `settings-tab.test.tsx:761`)
- **AI-T9** Run all gates: `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build`
- **AI-T10** Verify no to-be-planted `TODO(activate-ai-rag-provider)` markers
  remain and the
  loud-stub error is gone from any activated entry point
- **AI-T11** User acceptance: head/admin opens the integrations sub-tab, sees
  the AI Summary card show a configured provider and a non-empty corpus, and a
  published report yields a real auto-summary
- **AI-T12** Commit: `feat(ai): activate AI/RAG provider (Phase 54)`

## Verification

```bash
pnpm --filter @customreport/api test -- \
  src/modules/ai/__tests__/ai.ingestion.integration.test.ts
pnpm --filter @customreport/web test -- \
  src/components/admin/settings-tab.test.tsx
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

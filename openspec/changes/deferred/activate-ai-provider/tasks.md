# Tasks

- [ ] T1: Create `apps/api/src/lib/ai-client.ts` with provider-agnostic
      interface (`AiProvider` abstract class or interface with `summarizeText()`
      and `generateTitle()` methods)
- [ ] T2: Create `apps/api/src/lib/adapters/anthropic-adapter.ts` — implement
      AiProvider using Anthropic Claude (or chosen provider); handle API key,
      timeouts, rate limits
- [ ] T3: Create provider config — add `AI_PROVIDER` and `AI_PROVIDER_KEY` env
      vars to `.env.example` and `.env.test.example`
- [ ] T4: Update `ai.module.ts:29` — inject provider adapter and remove stub
- [ ] T5: Update `ai-summary.service.ts:78` — call real provider adapter
      instead of throwing "Not implemented"
- [ ] T6: Add error handling — catch provider errors, log, return fallback
      response (e.g., "Unable to generate summary. Try again.")
- [ ] T7: Add integration tests — mock provider, test summarize/generate flows,
      verify error handling
- [ ] T8: Commit — `feat(ai): activate real provider adapter (Phase 54
    completion)`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      manual test generation endpoint with mock/real provider

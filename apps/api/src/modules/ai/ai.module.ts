import { Module } from "@nestjs/common";

import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { AI_ADAPTER, type AiAdapter } from "./ai.adapter.js";
import { AiService } from "./ai.service.js";
import { AiPrismaFacade } from "./ai-facade.js";
import { AiIngestionService } from "./ai-ingestion.service.js";
import { AiSummaryCache, NullAiSummaryCache } from "./ai-summary.cache.js";
import { AiSummaryPrismaRepository } from "./ai-summary.prisma-repository.js";
import { AiSummaryService } from "./ai-summary.service.js";
import { MockAiAdapter } from "./mock-ai.adapter.js";

/**
 * Phase 54 (UFB-055): selects the adapter based on env. `mock` (or
 * unset, for tests / fresh dev shells) returns MockAiAdapter; any
 * other value throws so a misconfigured deploy fails loud at boot
 * rather than silently returning an empty summary in production.
 *
 * Real providers (Claude / GPT / YandexGPT / on-prem Llama) plug in
 * here when the org picks one and budgets it. They will land in their
 * own files (`anthropic-ai.adapter.ts`, etc.) so this switch stays
 * the only place that knows about provider selection.
 */
export function selectAiAdapter(): AiAdapter {
  const provider = process.env["AI_PROVIDER"] ?? "mock";
  if (provider === "mock") {
    return new MockAiAdapter();
  }
  // TODO(Phase-54-activation): wire real AI provider here when org picks one.
  // Expected providers: 'anthropic' | 'openai' | 'yandexgpt' | 'llama'.
  // Each lands in its own adapter file (e.g. `anthropic-ai.adapter.ts`).
  // See .planning/phases/54-ai-rag/54-PHASE-SUMMARY.md "Open questions".
  // CLAUDE.md "TODO discipline" rule applies.
  throw new Error(
    `Not implemented — see TODO(Phase-54-activation). AI provider not configured: ${provider}`,
  );
}

@Module({
  imports: [PrismaModule],
  providers: [
    AiPrismaFacade,
    {
      provide: AiService,
      useFactory: (facade: AiPrismaFacade) => new AiService(facade),
      inject: [AiPrismaFacade],
    },
    // Phase 54 (UFB-055): RAG/period-summary seam — separate from the
    // Phase 31/32 AiService. Lives under the same module so the future
    // real provider can reuse the AiPrismaFacade if it needs to.
    {
      provide: AI_ADAPTER,
      useFactory: () => selectAiAdapter(),
    },
    AiSummaryCache,
    AiSummaryPrismaRepository,
    {
      provide: AiSummaryService,
      // The Redis-backed cache is the production wiring; the in-process
      // null cache stays available for tests that want a clean call
      // count without going through ioredis. The Prisma repository is
      // attached via setRepository so the AiSummaryService constructor
      // stays minimal (only the two ports it cannot run without).
      useFactory: (
        adapter: AiAdapter,
        cache: AiSummaryCache,
        repo: AiSummaryPrismaRepository,
      ) => {
        const service = new AiSummaryService(adapter, cache);
        service.setRepository(repo);
        return service;
      },
      inject: [AI_ADAPTER, AiSummaryCache, AiSummaryPrismaRepository],
    },
    AiIngestionService,
  ],
  exports: [AiService, AiSummaryService, AiIngestionService],
})
export class AiModule {}

// Re-exports kept at the bottom of the file so consumers (router,
// tests) can import the in-process fallback cache without reaching
// into the implementation file.
export { NullAiSummaryCache };

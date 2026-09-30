import "reflect-metadata";

import type { ClassProvider, Provider, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ClsService } from "nestjs-cls";
import { describe, expect, it, vi } from "vitest";

import { WorkerLivenessRegistry } from "../../infrastructure/bullmq/worker-liveness.registry.js";
import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import { AiProviderPrometheusMetrics } from "../../infrastructure/metrics/ai-provider.metrics.js";
import { ReportAssistantResourceGuard } from "../../infrastructure/throttler/report-assistant-resource-guard.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import { createNullLogger } from "../../lib/logger.js";
import { NOOP_METRICS } from "../ai-provider/application/ai-provider.service-types.js";
import {
  AesGcmCredentialCodec,
  AI_PROVIDER_CAPABILITY_TESTER,
  AI_PROVIDER_TEST_ENQUEUER,
  AiProviderConfigurationRepository,
  AiProviderConfigurationService,
  AiProviderTestProcessor,
} from "../ai-provider/index.js";
import { AiRuntimeResolver } from "./application/ai-runtime.resolver.js";
import { ReportAssistantService } from "./application/report-assistant.service.js";
import { REPORT_ASSISTANT_TELEMETRY } from "./application/report-assistant.telemetry.js";
import { SEMANTIC_INDEX_ENQUEUER } from "./application/semantic-index.enqueuer.js";
import { SemanticPreparationCoordinator } from "./application/semantic-preparation.coordinator.js";
import { AiRuntimeConfigurationRepository } from "./infrastructure/ai-runtime-configuration.prisma-repository.js";
import { ReportSearchPrismaRepository } from "./infrastructure/report-search.prisma-repository.js";
import { SemanticEmbeddingPrismaRepository } from "./infrastructure/semantic-embedding.prisma-repository.js";
import { SemanticIndexProcessor } from "./infrastructure/semantic-index.processor.js";
import { SemanticIndexPrismaSourceLoader } from "./infrastructure/semantic-index.source.prisma-loader.js";
import { createSearchProviders } from "./search.providers.js";

const nativeClasses: Type<unknown>[] = [
  AiRuntimeResolver,
  SemanticPreparationCoordinator,
  AiProviderConfigurationService,
  AiProviderTestProcessor,
  SemanticIndexProcessor,
  ReportAssistantService,
];

const nativeProviders = (): ClassProvider[] =>
  createSearchProviders().filter(
    (provider): provider is ClassProvider =>
      typeof provider === "object" &&
      "useClass" in provider &&
      nativeClasses.includes(provider.useClass),
  );

function createNativeModule() {
  const info = vi.fn();
  const resolveReportAssistant = vi.fn().mockResolvedValue(null);
  const acquire = vi.fn().mockResolvedValue({
    kind: "denied",
    retryAfterSeconds: 3,
  });
  const providerRepository = {
    getRevision: vi.fn().mockResolvedValue({
      lifecycle: "failed",
      generationProfile: "mistral",
      embeddingMode: "reuse_generation",
      plannerModel: "planner-model",
      answerModel: "answer-model",
      embeddingModel: "embedding-model",
    }),
    discardDisposable: vi.fn().mockResolvedValue(true),
  };
  const providers: Provider[] = [
    ...nativeProviders(),
    {
      provide: AiProviderConfigurationRepository,
      useValue: providerRepository,
    },
    { provide: AesGcmCredentialCodec, useValue: {} },
    { provide: AI_PROVIDER_CAPABILITY_TESTER, useValue: {} },
    { provide: AiProviderPrometheusMetrics, useValue: NOOP_METRICS },
    { provide: AI_PROVIDER_TEST_ENQUEUER, useValue: {} },
    { provide: ReportSearchPrismaRepository, useValue: {} },
    { provide: SemanticEmbeddingPrismaRepository, useValue: {} },
    { provide: SemanticIndexPrismaSourceLoader, useValue: {} },
    { provide: SEMANTIC_INDEX_ENQUEUER, useValue: {} },
    { provide: APP_LOGGER, useValue: { ...createNullLogger(), info } },
    { provide: ClsService, useValue: {} },
    { provide: WorkerLivenessRegistry, useValue: {} },
    { provide: REPORT_ASSISTANT_TELEMETRY, useValue: { record: vi.fn() } },
    { provide: ReportAssistantResourceGuard, useValue: { acquire } },
    {
      provide: AiRuntimeConfigurationRepository,
      useValue: { resolveReportAssistant },
    },
    {
      provide: ENV_CONFIG,
      useValue: {
        AUTH_JWT_SECRET: "search-provider-test-secret-at-least-32-characters",
        REPORT_ASSISTANT_CANDIDATE_LIMIT: 1,
        REPORT_ASSISTANT_EXHAUSTIVE_LIMIT: 100,
        REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET: 10_000,
        REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE: 2,
        REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED: true,
      },
    },
  ];
  return {
    module: Test.createTestingModule({ providers }),
    info,
    providerRepository,
    resolveReportAssistant,
    acquire,
  };
}

describe("Search native provider wiring", () => {
  it("resolves production classes and preserves runtime, resource and audit dependencies", async () => {
    const providers = nativeProviders();
    expect(new Set(providers.map(({ useClass }) => useClass))).toEqual(
      new Set(nativeClasses),
    );
    const fixture = createNativeModule();
    const moduleRef = await fixture.module.compile();
    try {
      for (const provider of providers) {
        expect(moduleRef.get(provider.provide)).toBeInstanceOf(
          provider.useClass,
        );
      }
      expect(await moduleRef.get(AiRuntimeResolver).resolveActive()).toBeNull();
      expect(fixture.resolveReportAssistant).toHaveBeenCalledOnce();
      expect(
        await moduleRef
          .get(ReportAssistantService)
          .answer(
            { question: "Report status?", resolutionTokens: [] },
            "actor-1",
          ),
      ).toEqual({ kind: "resource_limited", retryAfterSeconds: 3 });
      expect(fixture.acquire).toHaveBeenCalledWith("actor-1");
      expect(
        await moduleRef
          .get(AiProviderConfigurationService)
          .discard("revision-1", "actor-1"),
      ).toEqual({ discarded: true });
      expect(fixture.providerRepository.discardDisposable).toHaveBeenCalledWith(
        "revision-1",
      );
      expect(fixture.info).toHaveBeenCalledWith("ai_provider.audit", {
        event: "ai_provider.discarded",
        actorId: "actor-1",
        revisionId: "revision-1",
        generationProfile: "mistral",
        embeddingMode: "reuse_generation",
        plannerModel: "planner-model",
        answerModel: "answer-model",
        embeddingModel: "embedding-model",
      });
    } finally {
      await moduleRef.close();
    }
  });
});

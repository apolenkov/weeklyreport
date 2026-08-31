import { getQueueToken } from "@nestjs/bullmq";
import type { Provider } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import { WorkerLivenessRegistry } from "../../infrastructure/bullmq/worker-liveness.registry.js";
import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { AiProviderPrometheusMetrics } from "../../infrastructure/metrics/ai-provider.metrics.js";
import { ReportAssistantResourceGuard } from "../../infrastructure/throttler/report-assistant-resource-guard.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  AesGcmCredentialCodec,
  AI_PROVIDER_TEST_ENQUEUER,
  AI_PROVIDER_TEST_QUEUE_NAME,
  AiProviderConfigurationRepository,
  AiProviderConfigurationService,
  AiProviderTestBullmqEnqueuer,
  type AiProviderTestEnqueuer,
  AiProviderTestProcessor,
} from "../ai-provider/index.js";
import {
  AiRuntimeResolver,
  type AiRuntimeResolverPort,
} from "./application/ai-runtime.resolver.js";
import { REPORT_ASSISTANT_TELEMETRY } from "./application/report-assistant.telemetry.js";
import { SearchService } from "./application/search.service.js";
import type { SemanticEmbeddingRepository } from "./application/semantic-embedding.repository.js";
import {
  SEMANTIC_INDEX_ENQUEUER,
  type SemanticIndexEnqueuer,
} from "./application/semantic-index.enqueuer.js";
import { SemanticPreparationCoordinator } from "./application/semantic-preparation.coordinator.js";
import { AiRuntimeConfigurationRepository } from "./infrastructure/ai-runtime-configuration.prisma-repository.js";
import { OpenAiCompatibleCapabilityTester } from "./infrastructure/openai-compatible.capability-tester.js";
import { ReportAssistantPrometheusTelemetry } from "./infrastructure/report-assistant-prometheus-telemetry.adapter.js";
import { ReportSearchPrismaRepository } from "./infrastructure/report-search.prisma-repository.js";
import { SearchPrismaRepository } from "./infrastructure/search.prisma-repository.js";
import { SemanticEmbeddingPrismaRepository } from "./infrastructure/semantic-embedding.prisma-repository.js";
import { SemanticIndexProcessor } from "./infrastructure/semantic-index.processor.js";
import {
  SEMANTIC_INDEX_QUEUE_NAME,
  SemanticIndexBullmqEnqueuer,
} from "./infrastructure/semantic-index.queue.js";
import { SemanticIndexPrismaSourceLoader } from "./infrastructure/semantic-index.source.prisma-loader.js";
import { reportAssistantProvider } from "./search.report-assistant.provider.js";

export const createSearchProviders = (): Provider[] => [
  SearchPrismaRepository,
  ReportSearchPrismaRepository,
  SemanticEmbeddingPrismaRepository,
  SemanticIndexPrismaSourceLoader,
  AiRuntimeConfigurationRepository,
  AiProviderPrometheusMetrics,
  {
    provide: AI_PROVIDER_TEST_ENQUEUER,
    useFactory: (queue: JobEnqueuer): AiProviderTestEnqueuer =>
      new AiProviderTestBullmqEnqueuer(queue),
    inject: [getQueueToken(AI_PROVIDER_TEST_QUEUE_NAME)],
  },
  {
    provide: OpenAiCompatibleCapabilityTester,
    useFactory: (env: EnvConfig) =>
      new OpenAiCompatibleCapabilityTester(
        env.REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS,
        env.REPORT_ASSISTANT_PLANNER_MAX_TOKENS,
        env.REPORT_ASSISTANT_ANSWER_MAX_TOKENS,
        env.REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE,
        env.REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET,
      ),
    inject: [ENV_CONFIG],
  },
  {
    provide: REPORT_ASSISTANT_TELEMETRY,
    useClass: ReportAssistantPrometheusTelemetry,
  },
  {
    provide: SEMANTIC_INDEX_ENQUEUER,
    useFactory: (queue: JobEnqueuer) => new SemanticIndexBullmqEnqueuer(queue),
    inject: [getQueueToken(SEMANTIC_INDEX_QUEUE_NAME)],
  },
  {
    provide: AiRuntimeResolver,
    useFactory: (
      repository: AiProviderConfigurationRepository,
      codec: AesGcmCredentialCodec,
      semanticRepository: SemanticEmbeddingRepository,
      enqueuer: SemanticIndexEnqueuer,
      env: EnvConfig,
      configurationRepository: AiRuntimeConfigurationRepository,
    ) =>
      new AiRuntimeResolver(
        repository,
        codec,
        semanticRepository,
        enqueuer,
        env,
        configurationRepository,
      ),
    inject: [
      AiProviderConfigurationRepository,
      AesGcmCredentialCodec,
      SemanticEmbeddingPrismaRepository,
      SEMANTIC_INDEX_ENQUEUER,
      ENV_CONFIG,
      AiRuntimeConfigurationRepository,
    ],
  },
  {
    provide: SemanticPreparationCoordinator,
    useFactory: (
      reports: ReportSearchPrismaRepository,
      resolver: AiRuntimeResolverPort,
      semanticRepository: SemanticEmbeddingRepository,
      enqueuer: SemanticIndexEnqueuer,
      env: EnvConfig,
    ) =>
      new SemanticPreparationCoordinator(
        reports,
        resolver,
        semanticRepository,
        enqueuer,
        env.REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE,
      ),
    inject: [
      ReportSearchPrismaRepository,
      AiRuntimeResolver,
      SemanticEmbeddingPrismaRepository,
      SEMANTIC_INDEX_ENQUEUER,
      ENV_CONFIG,
    ],
  },
  {
    provide: AiProviderConfigurationService,
    useFactory: (
      repository: AiProviderConfigurationRepository,
      codec: AesGcmCredentialCodec,
      env: EnvConfig,
      tester: OpenAiCompatibleCapabilityTester,
      preparation: SemanticPreparationCoordinator,
      logger: AppLogger,
      metrics: AiProviderPrometheusMetrics,
      testEnqueuer: AiProviderTestEnqueuer,
    ) =>
      new AiProviderConfigurationService(
        repository,
        codec,
        env,
        tester,
        preparation,
        {
          record: (event) => logger.info("ai_provider.audit", { ...event }),
        },
        metrics,
        testEnqueuer,
      ),
    inject: [
      AiProviderConfigurationRepository,
      AesGcmCredentialCodec,
      ENV_CONFIG,
      OpenAiCompatibleCapabilityTester,
      SemanticPreparationCoordinator,
      APP_LOGGER,
      AiProviderPrometheusMetrics,
      AI_PROVIDER_TEST_ENQUEUER,
    ],
  },
  {
    provide: AiProviderTestProcessor,
    useFactory: (
      repository: AiProviderConfigurationRepository,
      service: AiProviderConfigurationService,
      env: EnvConfig,
      logger: AppLogger,
      cls: ClsService,
      workerLiveness: WorkerLivenessRegistry,
    ) =>
      new AiProviderTestProcessor(
        repository,
        service,
        env,
        logger,
        cls,
        workerLiveness,
      ),
    inject: [
      AiProviderConfigurationRepository,
      AiProviderConfigurationService,
      ENV_CONFIG,
      APP_LOGGER,
      ClsService,
      WorkerLivenessRegistry,
    ],
  },
  {
    provide: SemanticIndexProcessor,
    useFactory: (
      sourceLoader: SemanticIndexPrismaSourceLoader,
      repository: SemanticEmbeddingRepository,
      resolver: AiRuntimeResolverPort,
      env: EnvConfig,
      logger: AppLogger,
      cls: ClsService,
      workerLiveness: WorkerLivenessRegistry,
    ) =>
      new SemanticIndexProcessor(
        sourceLoader,
        repository,
        {
          resolveRuntime: async (revisionId) => {
            const runtime = await resolver.resolveExact(revisionId);
            return { embeddings: runtime.embeddings, scope: runtime.scope };
          },
        },
        env,
        logger,
        cls,
        workerLiveness,
      ),
    inject: [
      SemanticIndexPrismaSourceLoader,
      SemanticEmbeddingPrismaRepository,
      AiRuntimeResolver,
      ENV_CONFIG,
      APP_LOGGER,
      ClsService,
      WorkerLivenessRegistry,
    ],
  },
  reportAssistantProvider,
  {
    provide: ReportAssistantResourceGuard,
    useFactory: (env: EnvConfig, logger: AppLogger) =>
      new ReportAssistantResourceGuard(env, logger),
    inject: [ENV_CONFIG, APP_LOGGER],
  },
  {
    provide: SearchService,
    useFactory: (repo: SearchPrismaRepository) => new SearchService(repo),
    inject: [SearchPrismaRepository],
  },
];

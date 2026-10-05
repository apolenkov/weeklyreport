import { getQueueToken } from "@nestjs/bullmq";
import type { Provider } from "@nestjs/common";

import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { AiProviderPrometheusMetrics } from "../../infrastructure/metrics/ai-provider.metrics.js";
import { ReportAssistantResourceGuard } from "../../infrastructure/throttler/report-assistant-resource-guard.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  AI_PROVIDER_CAPABILITY_TESTER,
  AI_PROVIDER_PREPARATION_COORDINATOR,
  AI_PROVIDER_TEST_ENQUEUER,
  AI_PROVIDER_TEST_QUEUE_NAME,
  AI_RUNTIME_HEALTH,
  AiProviderConfigurationService,
  AiProviderTestBullmqEnqueuer,
  type AiProviderTestEnqueuer,
  AiProviderTestProcessor,
  type AiRuntimeHealth,
  RedisAiRuntimeHealth,
} from "../ai-provider/index.js";
import { AiRuntimeResolver } from "./application/ai-runtime.resolver.js";
import { REPORT_ASSISTANT_TELEMETRY } from "./application/report-assistant.telemetry.js";
import { SearchService } from "./application/search.service.js";
import { SEMANTIC_INDEX_ENQUEUER } from "./application/semantic-index.enqueuer.js";
import { SemanticPreparationCoordinator } from "./application/semantic-preparation.coordinator.js";
import { AiRuntimeConfigurationRepository } from "./infrastructure/ai-runtime-configuration.prisma-repository.js";
import { OpenAiCompatibleCapabilityTester } from "./infrastructure/openai-compatible.capability-tester.js";
import { ReportAssistantHealthTelemetry } from "./infrastructure/report-assistant-health-telemetry.adapter.js";
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
    provide: AI_PROVIDER_CAPABILITY_TESTER,
    useFactory: (env: EnvConfig) =>
      new OpenAiCompatibleCapabilityTester({
        timeoutMs: env.REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS,
        plannerMaxTokens: env.REPORT_ASSISTANT_PLANNER_MAX_TOKENS,
        answerMaxTokens: env.REPORT_ASSISTANT_ANSWER_MAX_TOKENS,
        embeddingBatchSize: env.REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE,
        embeddingTokenBudget: env.REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET,
      }),
    inject: [ENV_CONFIG],
  },
  {
    provide: AI_RUNTIME_HEALTH,
    useFactory: (env: EnvConfig) => new RedisAiRuntimeHealth(env),
    inject: [ENV_CONFIG],
  },
  {
    provide: REPORT_ASSISTANT_TELEMETRY,
    useFactory: (health: AiRuntimeHealth) =>
      new ReportAssistantHealthTelemetry(
        new ReportAssistantPrometheusTelemetry(),
        health,
      ),
    inject: [AI_RUNTIME_HEALTH],
  },
  {
    provide: SEMANTIC_INDEX_ENQUEUER,
    useFactory: (queue: JobEnqueuer) => new SemanticIndexBullmqEnqueuer(queue),
    inject: [getQueueToken(SEMANTIC_INDEX_QUEUE_NAME)],
  },
  {
    provide: AiRuntimeResolver,
    useClass: AiRuntimeResolver,
  },
  {
    provide: AI_PROVIDER_PREPARATION_COORDINATOR,
    useClass: SemanticPreparationCoordinator,
  },
  {
    provide: AiProviderConfigurationService,
    useClass: AiProviderConfigurationService,
  },
  {
    provide: AiProviderTestProcessor,
    useClass: AiProviderTestProcessor,
  },
  {
    provide: SemanticIndexProcessor,
    useClass: SemanticIndexProcessor,
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
    useFactory: (repo: SearchPrismaRepository, logger: AppLogger) =>
      new SearchService(repo, logger.child({ service: "SearchService" })),
    inject: [SearchPrismaRepository, APP_LOGGER],
  },
];

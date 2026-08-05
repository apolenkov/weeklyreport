import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module.js";
import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { createClarificationTokenCodec } from "./application/clarification-token.js";
import {
  type EmbeddingPort,
  REPORT_ASSISTANT_ANSWERER,
  REPORT_ASSISTANT_EMBEDDINGS,
  REPORT_ASSISTANT_PLANNER,
  type ReportAssistantAnswerPort,
  type ReportAssistantPlannerPort,
} from "./application/report-assistant.ports.js";
import {
  createReportAssistantClock,
  resolveReportAssistantTimeZone,
} from "./application/report-assistant.runtime.js";
import { ReportAssistantService } from "./application/report-assistant.service.js";
import {
  REPORT_ASSISTANT_TELEMETRY,
  type ReportAssistantTelemetry,
} from "./application/report-assistant.telemetry.js";
import { SearchService } from "./application/search.service.js";
import type {
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "./application/semantic-embedding.repository.js";
import {
  SEMANTIC_INDEX_ENQUEUER,
  type SemanticIndexEnqueuer,
} from "./application/semantic-index.enqueuer.js";
import { SemanticRetrievalService } from "./application/semantic-retrieval.service.js";
import {
  MistralAnswerAdapter,
  type MistralAnswerAdapterConfig,
} from "./infrastructure/mistral-answer.adapter.js";
import {
  createMistralEmbeddingClient,
  MISTRAL_PROVIDER_NAME,
  MistralEmbeddingAdapter,
  type MistralEmbeddingAdapterConfig,
} from "./infrastructure/mistral-embedding.adapter.js";
import {
  createMistralChatClient,
  createMistralStructuredChatClient,
  MistralPlannerAdapter,
  type MistralPlannerAdapterConfig,
} from "./infrastructure/mistral-planner.adapter.js";
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

const clientConfig = (env: EnvConfig) => ({
  apiKey: env.MISTRAL_API_KEY,
  server: env.MISTRAL_API_SERVER,
  providerTimeoutMs: env.REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS,
});

const plannerConfig = (env: EnvConfig): MistralPlannerAdapterConfig => ({
  ...clientConfig(env),
  model: env.MISTRAL_PLANNER_MODEL,
  maxTokens: env.REPORT_ASSISTANT_PLANNER_MAX_TOKENS,
});

const answerConfig = (env: EnvConfig): MistralAnswerAdapterConfig => ({
  ...clientConfig(env),
  model: env.MISTRAL_ANSWER_MODEL,
  maxTokens: env.REPORT_ASSISTANT_ANSWER_MAX_TOKENS,
});

const embeddingConfig = (env: EnvConfig): MistralEmbeddingAdapterConfig => ({
  ...clientConfig(env),
  model: env.MISTRAL_EMBEDDING_MODEL,
  dimensions: env.MISTRAL_EMBEDDING_DIMENSIONS,
  batchSize: env.REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE,
  tokenBudget: env.REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET,
});

const semanticScope = (env: EnvConfig): SemanticEmbeddingScope => ({
  provider: MISTRAL_PROVIDER_NAME,
  model: env.MISTRAL_EMBEDDING_MODEL,
  inputVersion: env.REPORT_ASSISTANT_INPUT_VERSION,
  dimensions: env.MISTRAL_EMBEDDING_DIMENSIONS,
});

/** Prisma-free search services with infrastructure adapters injected by Nest. */
@Module({
  imports: [BullMQModule, ConfigModule],
  providers: [
    SearchPrismaRepository,
    ReportSearchPrismaRepository,
    SemanticEmbeddingPrismaRepository,
    SemanticIndexPrismaSourceLoader,
    {
      provide: REPORT_ASSISTANT_TELEMETRY,
      useClass: ReportAssistantPrometheusTelemetry,
    },
    {
      provide: REPORT_ASSISTANT_PLANNER,
      useFactory: async (env: EnvConfig) => {
        const config = plannerConfig(env);
        return new MistralPlannerAdapter(
          await createMistralChatClient(config),
          config,
        );
      },
      inject: [ENV_CONFIG],
    },
    {
      provide: REPORT_ASSISTANT_ANSWERER,
      useFactory: async (env: EnvConfig) => {
        const config = answerConfig(env);
        return new MistralAnswerAdapter(
          await createMistralStructuredChatClient(config),
          config,
        );
      },
      inject: [ENV_CONFIG],
    },
    {
      provide: REPORT_ASSISTANT_EMBEDDINGS,
      useFactory: async (env: EnvConfig) => {
        const config = embeddingConfig(env);
        return new MistralEmbeddingAdapter(
          await createMistralEmbeddingClient(config),
          config,
        );
      },
      inject: [ENV_CONFIG],
    },
    {
      provide: SEMANTIC_INDEX_ENQUEUER,
      useFactory: (queue: JobEnqueuer, env: EnvConfig) =>
        new SemanticIndexBullmqEnqueuer(queue, semanticScope(env)),
      inject: [getQueueToken(SEMANTIC_INDEX_QUEUE_NAME), ENV_CONFIG],
    },
    {
      provide: SemanticRetrievalService,
      useFactory: (
        embeddings: EmbeddingPort,
        repository: SemanticEmbeddingRepository,
        enqueuer: SemanticIndexEnqueuer,
        env: EnvConfig,
      ) =>
        new SemanticRetrievalService(embeddings, repository, {
          scope: semanticScope(env),
          similarityThreshold: env.REPORT_ASSISTANT_SIMILARITY_THRESHOLD,
          readThroughLimit: env.REPORT_ASSISTANT_READ_THROUGH_LIMIT,
          enqueuer,
        }),
      inject: [
        REPORT_ASSISTANT_EMBEDDINGS,
        SemanticEmbeddingPrismaRepository,
        SEMANTIC_INDEX_ENQUEUER,
        ENV_CONFIG,
      ],
    },
    {
      provide: SemanticIndexProcessor,
      useFactory: (
        sourceLoader: SemanticIndexPrismaSourceLoader,
        embeddings: EmbeddingPort,
        repository: SemanticEmbeddingRepository,
        env: EnvConfig,
        logger: AppLogger,
        cls: ClsService,
      ) =>
        new SemanticIndexProcessor(
          sourceLoader,
          embeddings,
          repository,
          { scope: semanticScope(env) },
          env,
          logger,
          cls,
        ),
      inject: [
        SemanticIndexPrismaSourceLoader,
        REPORT_ASSISTANT_EMBEDDINGS,
        SemanticEmbeddingPrismaRepository,
        ENV_CONFIG,
        APP_LOGGER,
        ClsService,
      ],
    },
    {
      provide: ReportAssistantService,
      useFactory: (
        repository: ReportSearchPrismaRepository,
        planner: ReportAssistantPlannerPort,
        answerer: ReportAssistantAnswerPort,
        semanticRetrieval: SemanticRetrievalService,
        telemetry: ReportAssistantTelemetry,
        env: EnvConfig,
      ) =>
        new ReportAssistantService(
          repository,
          planner,
          answerer,
          createClarificationTokenCodec({
            AUTH_JWT_SECRET: env.AUTH_JWT_SECRET,
          }),
          {
            candidateLimit: env.REPORT_ASSISTANT_CANDIDATE_LIMIT,
            exhaustiveLimit: env.REPORT_ASSISTANT_EXHAUSTIVE_LIMIT,
            contextTokenBudget: env.REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET,
            model: env.MISTRAL_ANSWER_MODEL,
            timeZone: resolveReportAssistantTimeZone(),
          },
          createReportAssistantClock(),
          semanticRetrieval,
          telemetry,
        ),
      inject: [
        ReportSearchPrismaRepository,
        REPORT_ASSISTANT_PLANNER,
        REPORT_ASSISTANT_ANSWERER,
        SemanticRetrievalService,
        REPORT_ASSISTANT_TELEMETRY,
        ENV_CONFIG,
      ],
    },
    {
      provide: SearchService,
      useFactory: (repo: SearchPrismaRepository) => new SearchService(repo),
      inject: [SearchPrismaRepository],
    },
  ],
  exports: [SearchService, ReportAssistantService],
})
export class SearchModule {}

import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module.js";
import type { JobEnqueuer } from "../../infrastructure/bullmq/job-enqueuer.js";
import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { AiPromptPrometheusMetrics } from "../../infrastructure/metrics/ai-prompt.metrics.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  AesGcmCredentialCodec,
  AI_COMPATIBILITY_QUEUE_NAME,
  AiCompatibilityBullmqEnqueuer,
  AiProviderConfigurationRepository,
  AiProviderModule,
} from "../ai-provider/index.js";
import { AiPromptSyntheticEvaluator } from "./application/ai-prompt.evaluator.js";
import { AiPromptService } from "./application/ai-prompt.service.js";
import { OpenAiCompatiblePromptSyntheticProbe } from "./application/ai-prompt.synthetic-probe.js";
import { AiPromptRepository } from "./infrastructure/ai-prompt.repository.js";

@Module({
  imports: [AiProviderModule, BullMQModule, ConfigModule],
  providers: [
    AiPromptRepository,
    AiPromptPrometheusMetrics,
    {
      provide: AiPromptSyntheticEvaluator,
      useFactory: (codec: AesGcmCredentialCodec, env: EnvConfig) =>
        new AiPromptSyntheticEvaluator(
          new OpenAiCompatiblePromptSyntheticProbe({
            codec,
            timeoutMs: env.REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS,
            plannerMaxTokens: env.REPORT_ASSISTANT_PLANNER_MAX_TOKENS,
            answerMaxTokens: env.REPORT_ASSISTANT_ANSWER_MAX_TOKENS,
          }),
        ),
      inject: [AesGcmCredentialCodec, ENV_CONFIG],
    },
    {
      provide: AiPromptService,
      useFactory: (
        repository: AiPromptRepository,
        providerRepository: AiProviderConfigurationRepository,
        evaluator: AiPromptSyntheticEvaluator,
        logger: AppLogger,
        metrics: AiPromptPrometheusMetrics,
        queue: JobEnqueuer,
      ) =>
        new AiPromptService(
          repository,
          providerRepository,
          evaluator,
          undefined,
          {
            record: (event) => logger.info("ai_prompt.audit", { ...event }),
          },
          metrics,
          new AiCompatibilityBullmqEnqueuer(queue),
        ),
      inject: [
        AiPromptRepository,
        AiProviderConfigurationRepository,
        AiPromptSyntheticEvaluator,
        APP_LOGGER,
        AiPromptPrometheusMetrics,
        getQueueToken(AI_COMPATIBILITY_QUEUE_NAME),
      ],
    },
  ],
  exports: [AiPromptService],
})
export class AiPromptsModule {}

import { Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { AiPromptPrometheusMetrics } from "../../infrastructure/metrics/ai-prompt.metrics.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  AiProviderConfigurationRepository,
  AiProviderModule,
} from "../ai-provider/index.js";
import { AiPromptService } from "./application/ai-prompt.service.js";
import { AiPromptRepository } from "./infrastructure/ai-prompt.repository.js";

@Module({
  imports: [AiProviderModule, ConfigModule],
  providers: [
    AiPromptRepository,
    AiPromptPrometheusMetrics,
    {
      provide: AiPromptService,
      useFactory: (
        repository: AiPromptRepository,
        providerRepository: AiProviderConfigurationRepository,
        logger: AppLogger,
        metrics: AiPromptPrometheusMetrics,
      ) =>
        new AiPromptService(
          repository,
          providerRepository,
          undefined,
          {
            record: (event) => logger.info("ai_prompt.audit", { ...event }),
          },
          metrics,
        ),
      inject: [
        AiPromptRepository,
        AiProviderConfigurationRepository,
        APP_LOGGER,
        AiPromptPrometheusMetrics,
      ],
    },
  ],
  exports: [AiPromptService],
})
export class AiPromptsModule {}

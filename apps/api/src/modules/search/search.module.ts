import { Module } from "@nestjs/common";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module.js";
import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { AiProviderModule } from "../ai-provider/index.js";
import { AiProviderConfigurationService } from "../ai-provider/index.js";
import { AiRuntimeResolver } from "./application/ai-runtime.resolver.js";
import { ReportAssistantService } from "./application/report-assistant.service.js";
import { SearchService } from "./application/search.service.js";
import { createSearchProviders } from "./search.providers.js";

@Module({
  imports: [BullMQModule, ConfigModule, AiProviderModule],
  providers: createSearchProviders(),
  exports: [
    SearchService,
    ReportAssistantService,
    AiRuntimeResolver,
    AiProviderConfigurationService,
  ],
})
export class SearchModule {}

import { aiProviderAvailabilityReadSchema } from "@weeklyreport/shared";

import type { AiProviderConfigurationService } from "../../../modules/ai-provider/index.js";
import { withDomainErrorMapping } from "../trpc.error-mapper.js";
import { protectedProcedure, router } from "../trpc.middleware.js";

export interface AiRouterDeps {
  aiProviderService: AiProviderConfigurationService;
}

export function createAiRouter(deps: AiRouterDeps) {
  return router({
    availability: protectedProcedure
      .output(aiProviderAvailabilityReadSchema)
      .query(() =>
        withDomainErrorMapping(() => deps.aiProviderService.availability()),
      ),
  });
}

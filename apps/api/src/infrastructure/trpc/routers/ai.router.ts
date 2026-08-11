import { aiProviderAvailabilityReadSchema } from "@customreport/shared";
import { TRPCError } from "@trpc/server";

import type { AiProviderConfigurationService } from "../../../modules/ai-provider/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { protectedProcedure, router } from "../trpc.middleware.js";

export interface AiRouterDeps {
  aiProviderService?: AiProviderConfigurationService;
}

export function createAiRouter(deps: AiRouterDeps) {
  return router({
    availability: protectedProcedure
      .output(aiProviderAvailabilityReadSchema)
      .query(async () => {
        try {
          if (!deps.aiProviderService) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message:
                "AI provider configuration is not wired into the router.",
            });
          }
          return await deps.aiProviderService.availability();
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}

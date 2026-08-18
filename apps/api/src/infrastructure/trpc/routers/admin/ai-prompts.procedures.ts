import {
  aiPromptActivationInputSchema,
  aiPromptBundleReadSchema,
  aiPromptCatalogReadSchema,
  aiPromptDiscardInputSchema,
  aiPromptDiscardResultSchema,
  aiPromptDraftInputSchema,
  aiPromptFeatureInputSchema,
  aiPromptFeatureReadSchema,
  aiPromptOperationResultSchema,
  aiPromptRestoreInputSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";

import type { AiPromptService } from "../../../../modules/ai-prompts/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure } from "../../trpc.middleware.js";

export interface AdminAiPromptDeps {
  aiPromptService?: AiPromptService;
}

const requireService = (
  service: AiPromptService | undefined,
): AiPromptService => {
  if (!service) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI prompt management is not wired into the tRPC router.",
    });
  }
  return service;
};

export function createAdminAiPromptProcedures(deps: AdminAiPromptDeps) {
  return {
    list: adminProcedure.output(aiPromptCatalogReadSchema).query(async () => {
      try {
        return await requireService(deps.aiPromptService).list();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    get: adminProcedure
      .input(aiPromptFeatureInputSchema)
      .output(aiPromptFeatureReadSchema)
      .query(async ({ input }) => {
        try {
          return await requireService(deps.aiPromptService).read(
            input.featureKey,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    draft: adminProcedure
      .input(aiPromptDraftInputSchema)
      .output(aiPromptBundleReadSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiPromptService).draft(
            input,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    activate: adminProcedure
      .input(aiPromptActivationInputSchema)
      .output(aiPromptOperationResultSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiPromptService).activate(
            input,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    restore: adminProcedure
      .input(aiPromptRestoreInputSchema)
      .output(aiPromptOperationResultSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiPromptService).restore(
            input,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    discard: adminProcedure
      .input(aiPromptDiscardInputSchema)
      .output(aiPromptDiscardResultSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiPromptService).discard(
            input,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}

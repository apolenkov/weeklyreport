import {
  aiProviderConfigurationReadSchema,
  aiProviderControlReadSchema,
  aiProviderDiscardResultSchema,
  aiProviderDraftSchema,
  aiProviderPreparationProgressSchema,
  aiProviderRevisionInputSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";

import type { AiProviderConfigurationService } from "../../../../modules/ai-provider/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
} from "../../trpc.middleware.js";

export interface AdminAiProviderDeps {
  aiProviderService?: AiProviderConfigurationService;
}

const requireService = (
  service: AiProviderConfigurationService | undefined,
): AiProviderConfigurationService => {
  if (!service) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "AI provider configuration is not wired into the tRPC router.",
    });
  }
  return service;
};

export function createAdminAiProviderProcedures(deps: AdminAiProviderDeps) {
  return {
    get: adminProcedure.output(aiProviderControlReadSchema).query(async () => {
      try {
        return await requireService(deps.aiProviderService).read();
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    save: adminProcedure
      .input(aiProviderDraftSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderConfigurationReadSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiProviderService).save(
            input,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    test: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderConfigurationReadSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiProviderService).test(
            input.revisionId,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    activate: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderControlReadSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiProviderService).activate(
            input.revisionId,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    disable: adminProcedure
      .output(aiProviderControlReadSchema)
      .mutation(async ({ ctx }) => {
        try {
          return await requireService(deps.aiProviderService).disable(
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    restore: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderControlReadSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiProviderService).restore(
            input.revisionId,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    discard: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderDiscardResultSchema)
      .mutation(async ({ input, ctx }) => {
        try {
          return await requireService(deps.aiProviderService).discard(
            input.revisionId,
            ctx.session.userId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    progress: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .output(aiProviderPreparationProgressSchema)
      .query(async ({ input }) => {
        try {
          return await requireService(deps.aiProviderService).progress(
            input.revisionId,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  };
}

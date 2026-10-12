import {
  aiProviderConfigurationReadSchema,
  aiProviderControlReadSchema,
  aiProviderDiscardResultSchema,
  aiProviderDraftSchema,
  aiProviderPreparationProgressSchema,
  aiProviderRevisionInputSchema,
} from "@weeklyreport/shared";

import type { AiProviderConfigurationService } from "../../../../modules/ai-provider/index.js";
import { withDomainErrorMapping } from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
} from "../../trpc.middleware.js";

export interface AdminAiProviderDeps {
  aiProviderService: AiProviderConfigurationService;
}

export function createAdminAiProviderProcedures(deps: AdminAiProviderDeps) {
  return {
    get: adminProcedure
      .output(aiProviderControlReadSchema)
      .query(() => withDomainErrorMapping(() => deps.aiProviderService.read())),
    save: adminProcedure
      .input(aiProviderDraftSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderConfigurationReadSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiProviderService.save(input, ctx.session.userId),
        ),
      ),
    test: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderConfigurationReadSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiProviderService.test(input.revisionId, ctx.session.userId),
        ),
      ),
    activate: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderControlReadSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiProviderService.activate(input.revisionId, ctx.session.userId),
        ),
      ),
    disable: adminProcedure
      .output(aiProviderControlReadSchema)
      .mutation(({ ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiProviderService.disable(ctx.session.userId),
        ),
      ),
    restore: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderControlReadSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiProviderService.restore(input.revisionId, ctx.session.userId),
        ),
      ),
    discard: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiProviderDiscardResultSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiProviderService.discard(input.revisionId, ctx.session.userId),
        ),
      ),
    progress: adminProcedure
      .input(aiProviderRevisionInputSchema)
      .output(aiProviderPreparationProgressSchema)
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          deps.aiProviderService.progress(input.revisionId),
        ),
      ),
  };
}

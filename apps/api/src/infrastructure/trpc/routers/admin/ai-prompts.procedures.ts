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

import type { AiPromptService } from "../../../../modules/ai-prompts/index.js";
import { withDomainErrorMapping } from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
} from "../../trpc.middleware.js";

export interface AdminAiPromptDeps {
  aiPromptService: AiPromptService;
}

export function createAdminAiPromptProcedures(deps: AdminAiPromptDeps) {
  return {
    list: adminProcedure
      .output(aiPromptCatalogReadSchema)
      .query(() => withDomainErrorMapping(() => deps.aiPromptService.list())),
    get: adminProcedure
      .input(aiPromptFeatureInputSchema)
      .output(aiPromptFeatureReadSchema)
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          deps.aiPromptService.read(input.featureKey),
        ),
      ),
    draft: adminProcedure
      .input(aiPromptDraftInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiPromptBundleReadSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiPromptService.draft(input, ctx.session.userId),
        ),
      ),
    activate: adminProcedure
      .input(aiPromptActivationInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiPromptOperationResultSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiPromptService.activate(input, ctx.session.userId),
        ),
      ),
    restore: adminProcedure
      .input(aiPromptRestoreInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiPromptOperationResultSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiPromptService.restore(input, ctx.session.userId),
        ),
      ),
    discard: adminProcedure
      .input(aiPromptDiscardInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(aiPromptDiscardResultSchema)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.aiPromptService.discard(input, ctx.session.userId),
        ),
      ),
  };
}

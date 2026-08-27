import { z } from "zod";

import type { ReopenRequestAdminService } from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import {
  captureMutationAuditInputMiddleware,
  headProcedure,
} from "../../trpc.middleware.js";

const MAX_REOPEN_NOTE_LENGTH = 500;

interface ReopenRequestsDeps {
  readonly reopenRequestAdminService: ReopenRequestAdminService;
}

const listReopenRequestsInput = z
  .object({
    status: z
      .enum(["pending", "approved", "rejected", "all"])
      .default("pending"),
  })
  .optional();

const respondReopenRequestInput = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(MAX_REOPEN_NOTE_LENGTH).optional(),
});

// headProcedure (not adminProcedure): head ≠ admin in real deploy; reopen
// decision is a head capability.
export function createReopenRequestsProcedures(deps: ReopenRequestsDeps) {
  return {
    listReopenRequests: headProcedure
      .input(listReopenRequestsInput)
      .query(async ({ input, ctx }) => {
        try {
          return await deps.reopenRequestAdminService.listReopenRequests({
            ...(input?.status === undefined ? {} : { status: input.status }),
            session: ctx.session,
          });
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    respondReopenRequest: headProcedure
      .input(respondReopenRequestInput)
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ input, ctx }) => {
        try {
          return await deps.reopenRequestAdminService.respondReopenRequest({
            id: input.id,
            decision: input.decision,
            ...(input.note === undefined ? {} : { note: input.note }),
            decidedBy: ctx.session.userId,
            session: ctx.session,
          });
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    pendingReopenCount: headProcedure.query(async ({ ctx }) => {
      try {
        return await deps.reopenRequestAdminService.pendingReopenCount(
          ctx.session,
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
  };
}

import {
  MAX_REOPEN_NOTE_LENGTH,
  reopenRequestListInputSchema,
} from "@customreport/shared";
import { z } from "zod";

import type { ReopenRequestAdminService } from "../../../../modules/admin/index.js";
import { withDomainErrorMapping } from "../../trpc.error-mapper.js";
import {
  captureMutationAuditInputMiddleware,
  headProcedure,
} from "../../trpc.middleware.js";

interface ReopenRequestsDeps {
  readonly reopenRequestAdminService: ReopenRequestAdminService;
}

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
      .input(reopenRequestListInputSchema)
      .query(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.reopenRequestAdminService.listReopenRequests({
            ...input,
            session: ctx.session,
          }),
        ),
      ),
    respondReopenRequest: headProcedure
      .input(respondReopenRequestInput)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input, ctx }) =>
        withDomainErrorMapping(() =>
          deps.reopenRequestAdminService.respondReopenRequest({
            id: input.id,
            decision: input.decision,
            ...(input.note === undefined ? {} : { note: input.note }),
            decidedBy: ctx.session.userId,
            session: ctx.session,
          }),
        ),
      ),
    pendingReopenCount: headProcedure.query(({ ctx }) =>
      withDomainErrorMapping(() =>
        deps.reopenRequestAdminService.pendingReopenCount(ctx.session),
      ),
    ),
  };
}

import { z } from "zod";

import type { ReopenRequestAdminService } from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { headProcedure } from "../../trpc.middleware.js";

const MAX_REOPEN_NOTE_LENGTH = 500;

interface ReopenRequestsDeps {
  reopenRequestAdminService: ReopenRequestAdminService;
}

// Reopen requests — Lead-initiated, Head-decided. Lead's
// `leadForm.requestReopen` persists status=pending; head dashboard + Admin
// "Reopen Requests" tab consume these. Gate is `headProcedure`
// (head + admin), not `adminProcedure` — head ≠ admin in real deploy, and
// reopen-decisioning is a head capability.
export function createReopenRequestsProcedures(deps: ReopenRequestsDeps) {
  return {
    listReopenRequests: headProcedure
      .input(
        z
          .object({
            status: z
              .enum(["pending", "approved", "rejected", "all"])
              .default("pending"),
          })
          .optional(),
      )
      .query(async ({ input, ctx }) => {
        try {
          return await deps.reopenRequestAdminService.listReopenRequests({
            status: input?.status,
            session: ctx.session,
          });
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    respondReopenRequest: headProcedure
      .input(
        z.object({
          id: z.uuid(),
          decision: z.enum(["approved", "rejected"]),
          note: z.string().max(MAX_REOPEN_NOTE_LENGTH).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          return await deps.reopenRequestAdminService.respondReopenRequest({
            id: input.id,
            decision: input.decision,
            note: input.note,
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

import { TRPCError } from "@trpc/server";
import {
  paginationInputSchema,
  reminderDispatchResultSchema,
} from "@weeklyreport/shared";
import { z } from "zod";

import type { RemindersService } from "../../../modules/reminders/index.js";
import type { WeeklyReportService } from "../../../modules/weekly-report/index.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import {
  captureMutationAuditInputMiddleware,
  headProcedure,
  router,
} from "../trpc.middleware.js";

const DEFAULT_EXECUTION_LIST_LIMIT = 20;

export interface RemindersRouterDeps {
  remindersService: RemindersService;
  weeklyReportService: Pick<WeeklyReportService, "getCurrentEditableId">;
}

function createListExecutionsProcedure(deps: RemindersRouterDeps) {
  return headProcedure
    .input(
      z
        .object({ ruleId: z.uuid() })
        .extend(paginationInputSchema.unwrap().partial().shape),
    )
    .query(async ({ input, ctx }) => {
      try {
        const { ruleId, cursor, limit } = input;
        const pagination =
          cursor || limit
            ? { cursor, limit: limit ?? DEFAULT_EXECUTION_LIST_LIMIT }
            : undefined;

        // Non-admins see only their group's recipient rows. The allowlist
        // is resolved here and applied inside the service BEFORE pagination
        // so out-of-scope rows cannot consume page size or drive nextCursor.
        const recipientAllowlist =
          await deps.remindersService.scope.resolveExecutionsRecipientAllowlist(
            ctx.session,
            ruleId,
          );

        return await deps.remindersService.listExecutions(
          ruleId,
          pagination,
          recipientAllowlist,
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

// Client never sees lead emails; optional leadId scopes to one author.
function createDispatchPendingProcedure(deps: RemindersRouterDeps) {
  return headProcedure
    .input(
      z.object({
        reportId: z.uuid(),
        ruleId: z.uuid(),
        leadId: z.uuid().optional(),
      }),
    )
    .use(captureMutationAuditInputMiddleware)
    .output(reminderDispatchResultSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const currentEditableReportId =
          await deps.weeklyReportService.getCurrentEditableId(ctx.session);
        if (currentEditableReportId !== input.reportId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "report-not-active",
          });
        }
        return await deps.remindersService.scope.dispatchPendingReminders(
          ctx.session,
          input.reportId,
          input.ruleId,
          input.leadId,
        );
      } catch (error) {
        throw mapDomainError(error);
      }
    });
}

export function createRemindersRouter(deps: RemindersRouterDeps) {
  return router({
    listExecutions: createListExecutionsProcedure(deps),
    dispatchPending: createDispatchPendingProcedure(deps),
  });
}

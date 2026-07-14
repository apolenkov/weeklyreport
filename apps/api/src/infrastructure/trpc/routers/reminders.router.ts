import { paginationInputSchema } from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { RemindersService } from "../../../modules/reminders/reminders.service.js";
import { mapDomainError } from "../trpc.error-mapper.js";
import { headProcedure, router } from "../trpc.middleware.js";

const DEFAULT_EXECUTION_LIST_LIMIT = 20;

export interface RemindersRouterDeps {
  remindersService: RemindersService;
}

export function createRemindersRouter(deps: RemindersRouterDeps) {
  return router({
    execute: headProcedure
      .input(
        z.object({
          ruleId: z.uuid(),
          recipientEmail: z.email(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          await deps.remindersService.scope.authorizeExecute(
            ctx.session,
            input.ruleId,
            input.recipientEmail,
          );
          return await deps.remindersService.requestReminderExecution(
            input.ruleId,
            input.recipientEmail,
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    listExecutions: headProcedure
      .input(
        z
          .object({ ruleId: z.uuid() })
          .extend(paginationInputSchema.partial().shape),
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
      }),

    // Manual "Send Reminder" trigger from the head dashboard alert bar.
    // Resolves the active reminder rule + draft-section authors server-side
    // (the client never sees lead emails) and dispatches one execution per
    // pending lead via the existing dedupe-keyed pipeline.
    dispatchPending: headProcedure
      .input(
        z.object({
          reportId: z.uuid(),
          ruleId: z.uuid().optional(),
          // Scope dispatch to a single lead so the
          // Head Dashboard Remind button can ping one author without
          // exposing emails to the client. When undefined, falls back to
          // the original "every draft author" behaviour used by the
          // bulk AlertBar action.
          leadId: z.uuid().optional(),
        }),
      )
      .output(
        z.object({
          dispatched: z.number().int().nonnegative(),
          alreadySent: z.number().int().nonnegative(),
          skipped: z.number().int().nonnegative(),
          reason: z.string().optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const activeReportId = ctx.session.activeReportId;
          if (!activeReportId || activeReportId !== input.reportId) {
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
      }),
  });
}

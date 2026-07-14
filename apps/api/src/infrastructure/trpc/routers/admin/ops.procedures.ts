import { paginationInputSchema, queueNameSchema } from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import type { Queue } from "bullmq";
import { z } from "zod";

import type { ActionLogService } from "../../../../modules/admin/action-log.service.js";
import type { JobsService } from "../../../../modules/admin/jobs.service.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure, router } from "../../trpc.middleware.js";

const MAX_FAILED_JOBS_LIMIT = 200;

export interface AdminOpsDeps {
  /**
   * Read-only BullMQ Queue handle used by
   * `admin.dlqCount` to surface failed-job count. Optional so existing test
   * fixtures can call createAppRouter(stubDeps) without instantiating Redis.
   */
  emailReminderQueue?: Queue;
  /**
   * BullMQ DLQ admin surface — `admin.jobs.listFailed` /
   * `admin.jobs.retryFailed`. Optional so test fixtures and the role-coverage
   * harness can build the router with `{}` deps; in that mode the service
   * is constructed locally from an undefined Queue and every call returns
   * an empty/no-op result.
   */
  jobsService?: JobsService;
  /**
   * Queryable in-app mutation-audit history — `admin.actionLog.list`.
   * Optional so role-coverage test fixtures that build the router with `{}`
   * deps stay compiling; a real boot always wires it (see
   * `requireActionLogService` below).
   */
  actionLogService?: ActionLogService;
}

/**
 * drain-admin-router: resolve the action-log service or fail loudly.
 * Optional on `RouterDeps` only so role-coverage fixtures build with `{}`
 * deps; a real boot always wires it, so `undefined` here is a config bug.
 */
function requireActionLogService(deps: AdminOpsDeps): ActionLogService {
  if (!deps.actionLogService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Action log service is not configured.",
    });
  }
  return deps.actionLogService;
}

export function createAdminOpsProcedures(deps: AdminOpsDeps) {
  return {
    // BullMQ DLQ count — failed-jobs set of the
    // email-reminder queue. adminProcedure (admin/head only).
    // Returns { count: 0 } when the Queue handle is absent (e.g. unit test
    // wiring) so the procedure is always callable.
    dlqCount: adminProcedure.query(async () => {
      try {
        if (!deps.emailReminderQueue) {
          return { count: 0 };
        }
        const count = await deps.emailReminderQueue.getFailedCount();
        return { count };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),

    // Queryable in-app mutation audit history. The log rows are
    // written by mutationAuditMiddleware and keyed by the same correlation id
    // as the structured app.log line for support/debug lookups.
    actionLog: router({
      list: adminProcedure
        .input(paginationInputSchema.optional())
        .query(async ({ input }) => {
          try {
            return await requireActionLogService(deps).list(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),

    // BullMQ DLQ admin surface. Lifts the Bull Board view
    // (/admin/queues) into the in-app /admin?tab=jobs page so the head can
    // triage failed jobs without leaving the SPA. adminProcedure (admin/head
    // only). Mutation audit (procedure='admin.jobs.retryFailed', target=jobId)
    // is captured by mutationAuditMiddleware automatically.
    jobs: router({
      listFailed: adminProcedure
        .input(
          z.object({
            queue: queueNameSchema,
            cursor: z.number().int().min(0).optional(),
            limit: z
              .number()
              .int()
              .min(1)
              .max(MAX_FAILED_JOBS_LIMIT)
              .optional(),
          }),
        )
        .query(async ({ input }) => {
          try {
            const service = deps.jobsService;
            if (!service) {
              return { jobs: [], nextCursor: null };
            }
            return await service.listFailed(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),

      retryFailed: adminProcedure
        .input(
          z.object({
            queue: queueNameSchema,
            jobId: z.string().min(1),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            const service = deps.jobsService;
            if (!service) {
              return { retried: false, jobId: input.jobId };
            }
            return await service.retryFailed(input);
          } catch (error) {
            throw mapDomainError(error);
          }
        }),
    }),
  };
}

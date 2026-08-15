import {
  adminActionLogPageSchema,
  omitUndefinedProperties,
  paginationInputSchema,
  queueNameSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import type { Queue } from "bullmq";
import { z } from "zod";

import type { ActionLogService } from "../../../../modules/admin/index.js";
import type { JobsService } from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import { adminProcedure, router } from "../../trpc.middleware.js";

const MAX_FAILED_JOBS_LIMIT = 200;

export interface AdminOpsDeps {
  // Type-optional but runtime-guarded: an unwired dependency throws a loud
  // TRPCError, never an empty/no-op success (no-fallback policy).
  readonly emailReminderQueue?: Queue;
  readonly jobsService?: JobsService;
  readonly actionLogService?: ActionLogService;
}

// Fields are required at the type level; the guards still fail loud on a
// `{}`-cast fixture (or a broken composition) instead of no-op'ing.
function requireActionLogService(deps: AdminOpsDeps): ActionLogService {
  if (!deps.actionLogService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Action log service is not configured.",
    });
  }
  return deps.actionLogService;
}

function requireEmailReminderQueue(deps: AdminOpsDeps): Queue {
  if (!deps.emailReminderQueue) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Email reminder queue is not configured.",
    });
  }
  return deps.emailReminderQueue;
}

function requireJobsService(deps: AdminOpsDeps): JobsService {
  if (!deps.jobsService) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  }
  return deps.jobsService;
}

// Rows share correlation id with the structured app.log line for support.
function createActionLogRouter(deps: AdminOpsDeps) {
  return router({
    list: adminProcedure
      .input(paginationInputSchema.optional())
      .output(adminActionLogPageSchema)
      .query(async ({ input }) => {
        try {
          return await requireActionLogService(deps).list(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}

const listFailedInputSchema = z.object({
  queue: queueNameSchema,
  cursor: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(MAX_FAILED_JOBS_LIMIT).optional(),
});

const retryFailedInputSchema = z.object({
  queue: queueNameSchema,
  jobId: z.string().min(1),
});

// In-app DLQ triage so head need not leave the SPA for Bull Board.
function createJobsRouter(deps: AdminOpsDeps) {
  return router({
    listFailed: adminProcedure
      .input(listFailedInputSchema)
      .query(async ({ input }) => {
        try {
          return await requireJobsService(deps).listFailed(
            omitUndefinedProperties(input),
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    retryFailed: adminProcedure
      .input(retryFailedInputSchema)
      .mutation(async ({ input }) => {
        try {
          return await requireJobsService(deps).retryFailed(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
  });
}

export function createAdminOpsProcedures(deps: AdminOpsDeps) {
  return {
    dlqCount: adminProcedure.query(async () => {
      try {
        const count = await requireEmailReminderQueue(deps).getFailedCount();
        return { count };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    actionLog: createActionLogRouter(deps),
    jobs: createJobsRouter(deps),
  };
}

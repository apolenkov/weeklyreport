import {
  adminActionLogPageSchema,
  omitUndefinedProperties,
  paginationInputSchema,
  queueNameSchema,
} from "@customreport/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { ActionLogService } from "../../../../modules/admin/index.js";
import type { JobsService } from "../../../../modules/admin/index.js";
import { mapDomainError } from "../../trpc.error-mapper.js";
import {
  adminProcedure,
  captureMutationAuditInputMiddleware,
  headProcedure,
  router,
} from "../../trpc.middleware.js";

const MAX_FAILED_JOBS_LIMIT = 200;

export interface AdminOpsDeps {
  readonly jobsService: JobsService;
  readonly actionLogService: ActionLogService;
}

// Fields are required at the type level; the guards still fail loud on a
// `{}`-cast fixture (or a broken composition) instead of no-op'ing.
function requireActionLogService(
  service: ActionLogService | undefined,
): ActionLogService {
  if (!service) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Action log service is not configured.",
    });
  }
  return service;
}

function requireJobsService(service: JobsService | undefined): JobsService {
  if (!service) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Jobs service is not configured.",
    });
  }
  return service;
}

// Rows share correlation id with the structured app.log line for support.
function createActionLogRouter(deps: AdminOpsDeps) {
  return router({
    list: adminProcedure
      .input(paginationInputSchema.optional())
      .output(adminActionLogPageSchema)
      .query(async ({ input }) => {
        try {
          return await requireActionLogService(deps.actionLogService).list(
            input,
          );
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
const removeFailedInputSchema = retryFailedInputSchema;

// In-app DLQ triage so head need not leave the SPA for Bull Board.
function createJobsRouter(deps: AdminOpsDeps) {
  return router({
    listFailed: headProcedure
      .input(listFailedInputSchema)
      .query(async ({ input }) => {
        try {
          return await requireJobsService(deps.jobsService).listFailed(
            omitUndefinedProperties(input),
          );
        } catch (error) {
          throw mapDomainError(error);
        }
      }),

    retryFailed: headProcedure
      .input(retryFailedInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ input }) => {
        try {
          return await requireJobsService(deps.jobsService).retryFailed(input);
        } catch (error) {
          throw mapDomainError(error);
        }
      }),
    removeFailed: headProcedure
      .input(removeFailedInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(async ({ input }) => {
        try {
          return await requireJobsService(deps.jobsService).removeFailed(input);
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
        const count = await requireJobsService(deps.jobsService).countFailed();
        return { count };
      } catch (error) {
        throw mapDomainError(error);
      }
    }),
    actionLog: createActionLogRouter(deps),
    jobs: createJobsRouter(deps),
  };
}

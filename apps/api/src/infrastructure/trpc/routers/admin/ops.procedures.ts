import { TRPCError } from "@trpc/server";
import {
  adminActionLogPageSchema,
  omitUndefinedProperties,
  paginationInputSchema,
  pdfRecoveryCursorSchema,
  pdfRecoveryJobListSchema,
  pdfRecoveryRetryInputSchema,
  pdfRecoveryRetryResultSchema,
  queueNameSchema,
} from "@weeklyreport/shared";
import { z } from "zod";

import type { ActionLogService } from "../../../../modules/admin/index.js";
import type { JobsService } from "../../../../modules/admin/index.js";
import { withDomainErrorMapping } from "../../trpc.error-mapper.js";
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
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          requireActionLogService(deps.actionLogService).list(input),
        ),
      ),
  });
}

const listFailedInputSchema = z.object({
  queue: queueNameSchema,
  cursor: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(MAX_FAILED_JOBS_LIMIT).optional(),
});

const listPdfRecoveryInputSchema = z
  .object({
    cursor: pdfRecoveryCursorSchema.optional(),
    limit: z.number().int().min(1).max(MAX_FAILED_JOBS_LIMIT).optional(),
  })
  .prefault({});

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
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          requireJobsService(deps.jobsService).listFailed(
            omitUndefinedProperties(input),
          ),
        ),
      ),

    retryFailed: headProcedure
      .input(retryFailedInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          requireJobsService(deps.jobsService).retryFailed(input),
        ),
      ),
    removeFailed: headProcedure
      .input(removeFailedInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          requireJobsService(deps.jobsService).removeFailed(input),
        ),
      ),

    // DB-backed quarantine list — the generation's queue job may already be
    // gone, so Redis is never consulted.
    listPdfRecovery: headProcedure
      .input(listPdfRecoveryInputSchema)
      .output(pdfRecoveryJobListSchema)
      .query(({ input }) =>
        withDomainErrorMapping(() =>
          requireJobsService(deps.jobsService).listPdfRecovery(
            omitUndefinedProperties(input),
          ),
        ),
      ),

    retryPdfRecovery: headProcedure
      .input(pdfRecoveryRetryInputSchema)
      .use(captureMutationAuditInputMiddleware)
      .output(pdfRecoveryRetryResultSchema)
      .mutation(({ input }) =>
        withDomainErrorMapping(() =>
          requireJobsService(deps.jobsService).retryPdfRecovery(input),
        ),
      ),
  });
}

export function createAdminOpsProcedures(deps: AdminOpsDeps) {
  return {
    dlqCount: adminProcedure.query(() =>
      withDomainErrorMapping(() =>
        requireJobsService(deps.jobsService).countFailed(),
      ),
    ),
    actionLog: createActionLogRouter(deps),
    jobs: createJobsRouter(deps),
  };
}

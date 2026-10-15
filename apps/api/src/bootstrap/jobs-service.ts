import type { PdfRecoveryCursor, PdfRecoveryJob } from "@weeklyreport/shared";
import type { Queue } from "bullmq";

import { AdminBullmqJobsQueue } from "../infrastructure/bullmq/admin-jobs-queue.adapter.js";
import { QUEUE_NAMES } from "../infrastructure/bullmq/queue-registry.js";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { AppLogger } from "../lib/logger";
import { JobsService } from "../modules/admin/index.js";
import type { PdfExportService } from "../modules/pdf-export/index.js";

// Builds the admin DLQ registry from the BullMQ handles owned by Nest.
// Stays out of the NestJS DI graph (see the raw-Worker note in
// raw-bullmq-processor.ts).
export function createBootstrapJobsService(deps: {
  queueRegistry: { get: (name: (typeof QUEUE_NAMES)[number]) => Queue };
  prisma: PrismaService;
  logger: AppLogger;
  pdfExportService: Pick<PdfExportService, "retryExportGeneration">;
}): JobsService {
  const { queueRegistry, prisma, logger, pdfExportService } = deps;
  const queues = new Map(
    QUEUE_NAMES.map(
      (name) =>
        [
          name,
          new AdminBullmqJobsQueue(name, queueRegistry.get(name)),
        ] as const,
    ),
  );
  return new JobsService(
    {
      names: QUEUE_NAMES,
      get: (name) => {
        const queue = queues.get(name);
        if (!queue) throw new Error(`No admin queue for '${name}'`);
        return queue;
      },
    },
    {
      reminderExecutionExists: async (executionId) => {
        const execution = await prisma.reminderExecution.findUnique({
          where: { id: executionId },
          select: { id: true },
        });
        return execution !== null;
      },
      reviveFailedReminderExecution: async (executionId) => {
        // Only a terminal failure is revived; sent/pending rows are left alone,
        // and the worker's pending-only CAS keeps a re-sent row idempotent.
        await prisma.reminderExecution.updateMany({
          where: { id: executionId, status: "failed" },
          data: { status: "pending", error: null },
        });
      },
      retryPdfExportGeneration: (input) =>
        pdfExportService.retryExportGeneration(input),
      // Terminal rows are durable state: their generation's queue job may
      // already be pruned or removed, so the list is read from Postgres,
      // never Redis. Terminally `failed` rows are listed too — otherwise a
      // removed failed queue job would leave the row with no Head retry
      // surface even though retryExportGeneration accepts it.
      listPdfRecoveryJobs: (page) => listPdfRecoveryPage(prisma, page),
    },
    logger,
  );
}

// Keyset page: strictly after the cursor row, so a retried row leaving the set
// does not shift later pages. Exported so the DB integration suite reads the
// exact production query.
export async function listPdfRecoveryPage(
  prisma: Pick<PrismaService, "pdfExportJob">,
  { cursor, take }: { cursor?: PdfRecoveryCursor; take: number },
): Promise<PdfRecoveryJob[]> {
  const rows = await prisma.pdfExportJob.findMany({
    where: {
      status: { in: ["failed", "recovery_required"] },
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.jobId } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take,
    select: {
      id: true,
      reportId: true,
      generation: true,
      requestedBy: true,
      status: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    jobId: row.id,
    reportId: row.reportId,
    generation: row.generation,
    requestedBy: row.requestedBy,
    // Narrowed by the `in` filter above, not coerced — the procedure's
    // output schema re-validates the vocabulary on the wire.
    status: row.status as "failed" | "recovery_required",
    createdAt: row.createdAt,
  }));
}

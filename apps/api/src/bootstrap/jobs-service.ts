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
      // Quarantined rows are durable state: their generation's queue job may
      // already be pruned, so the list is read from Postgres, never Redis.
      listPdfRecoveryJobs: async () => {
        const rows = await prisma.pdfExportJob.findMany({
          where: { status: "recovery_required" },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            reportId: true,
            generation: true,
            requestedBy: true,
            createdAt: true,
          },
        });
        return rows.map((row) => ({
          jobId: row.id,
          reportId: row.reportId,
          generation: row.generation,
          requestedBy: row.requestedBy,
          status: "recovery_required" as const,
          createdAt: row.createdAt,
        }));
      },
    },
    logger,
  );
}

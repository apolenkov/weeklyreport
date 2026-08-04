import type { Queue } from "bullmq";

import { AdminBullmqJobsQueue } from "../infrastructure/bullmq/admin-jobs-queue.adapter.js";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { AppLogger } from "../lib/logger";
import { JobsService } from "../modules/admin/index.js";

// Thin wrapper around the email-reminder Queue handle for the admin DLQ tab.
// Stays out of the NestJS DI graph (see the raw-Worker note in
// raw-bullmq-processor.ts).
export function createBootstrapJobsService(deps: {
  emailReminderQueue: Queue;
  prisma: PrismaService;
  logger: AppLogger;
}): JobsService {
  const { emailReminderQueue, prisma, logger } = deps;
  return new JobsService(new AdminBullmqJobsQueue(emailReminderQueue), logger, {
    reminderExecutionExists: async (executionId) => {
      const execution = await prisma.reminderExecution.findUnique({
        where: { id: executionId },
        select: { id: true },
      });
      return execution !== null;
    },
  });
}

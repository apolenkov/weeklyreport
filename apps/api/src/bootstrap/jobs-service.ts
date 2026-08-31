import type { Queue } from "bullmq";

import { AdminBullmqJobsQueue } from "../infrastructure/bullmq/admin-jobs-queue.adapter.js";
import { QUEUE_NAMES } from "../infrastructure/bullmq/queue-registry.js";
import type { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { AppLogger } from "../lib/logger";
import { JobsService } from "../modules/admin/index.js";

// Builds the admin DLQ registry from the BullMQ handles owned by Nest.
// Stays out of the NestJS DI graph (see the raw-Worker note in
// raw-bullmq-processor.ts).
export function createBootstrapJobsService(deps: {
  queueRegistry: { get: (name: (typeof QUEUE_NAMES)[number]) => Queue };
  prisma: PrismaService;
  logger: AppLogger;
}): JobsService {
  const { queueRegistry, prisma, logger } = deps;
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
    },
    logger,
  );
}

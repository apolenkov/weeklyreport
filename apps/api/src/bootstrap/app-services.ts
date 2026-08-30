import type { INestApplication } from "@nestjs/common";

import { QueueRegistry } from "../infrastructure/bullmq/queue-registry.js";
import type { EnvConfig } from "../infrastructure/config/env.schema";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import type { AppRouter } from "../infrastructure/trpc/trpc.router";
import type { AppLogger } from "../lib/logger";
import type { AutoCarryOverOutcome } from "../modules/carry-over/index.js";
import { buildAppRouter } from "./app-router";
import { createAutoCarryOver } from "./auto-carry-over";
import { createBootstrapJobsService } from "./jobs-service";

// The cross-cutting singletons every ingress surface needs, assembled once so
// the queue handles and the carry-over closure have exactly one owner.
export function createAppServices(deps: {
  app: INestApplication;
  env: EnvConfig;
  logger: AppLogger;
}): {
  prisma: PrismaService;
  autoCarryOver: (targetReportId: string) => Promise<AutoCarryOverOutcome>;
  appRouter: AppRouter;
} {
  const { app, env, logger } = deps;

  // Shared BullModule handle for the email reminder worker and admin DLQ count.
  const queueRegistry = app.get(QueueRegistry);
  const emailReminderQueue = queueRegistry.get("email-reminder");

  const prisma = app.get(PrismaService);

  const jobsService = createBootstrapJobsService({
    emailReminderQueue,
    prisma,
    logger,
  });

  const autoCarryOver = createAutoCarryOver({ app, prisma, logger });

  const appRouter = buildAppRouter({
    app,
    prisma,
    env,
    autoCarryOver,
    emailReminderQueue,
    jobsService,
  });

  return { prisma, autoCarryOver, appRouter };
}

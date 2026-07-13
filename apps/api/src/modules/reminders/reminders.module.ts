import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { ClsService } from "nestjs-cls";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module";
import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { OrganizationModule } from "../organization/index.js";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";
import { RemindersReaperScheduler } from "./reminders-reaper.scheduler";

@Module({
  // `OrganizationModule` exposes `OrganizationService` so the scheduler can
  // snapshot the brand identity onto every BullMQ job.
  imports: [BullMQModule, OrganizationModule, ConfigModule],
  providers: [
    RemindersPrismaRepository,
    {
      provide: RemindersService,
      useFactory: (
        repo: RemindersPrismaRepository,
        logger: AppLogger,
        queue: Queue,
        cls: ClsService,
      ) => new RemindersService(repo, logger, queue, cls),
      inject: [
        RemindersPrismaRepository,
        APP_LOGGER,
        getQueueToken("email-reminder"),
        ClsService,
      ],
    },
    // Hourly @Cron deadline reminder dispatcher.
    RemindersScheduler,
    // Periodic @Cron sweep that re-enqueues executions stranded in `queued`.
    RemindersReaperScheduler,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}

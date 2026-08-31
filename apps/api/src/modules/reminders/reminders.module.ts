import { EMAIL_REMINDER_QUEUE_NAME } from "@customreport/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { ClsService } from "nestjs-cls";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module";
import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { ENV_CONFIG } from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { OrganizationModule } from "../organization/index.js";
import { OrganizationService } from "../organization/index.js";
import {
  REMINDERS_ENQUEUER,
  REMINDERS_TELEMETRY,
  type RemindersEnqueuer,
  type RemindersTelemetry,
} from "./reminders.ports.js";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";
import { RemindersBullmqEnqueuer } from "./reminders-bullmq-enqueuer.adapter.js";
import { RemindersReaperScheduler } from "./reminders-reaper.scheduler";
import { RemindersInfrastructureTelemetry } from "./reminders-telemetry.adapter.js";

@Module({
  // `OrganizationModule` exposes `OrganizationService` so the scheduler can
  // snapshot the brand identity onto every BullMQ job.
  imports: [BullMQModule, OrganizationModule, ConfigModule],
  providers: [
    RemindersPrismaRepository,
    {
      provide: REMINDERS_ENQUEUER,
      useFactory: (queue: Queue) => new RemindersBullmqEnqueuer(queue),
      inject: [getQueueToken(EMAIL_REMINDER_QUEUE_NAME)],
    },
    {
      provide: REMINDERS_TELEMETRY,
      useFactory: (cls: ClsService) =>
        new RemindersInfrastructureTelemetry(cls),
      inject: [ClsService],
    },
    {
      provide: RemindersService,
      useFactory: (
        repo: RemindersPrismaRepository,
        logger: AppLogger,
        queue: RemindersEnqueuer,
        telemetry: RemindersTelemetry,
        organizationService: OrganizationService,
        env: EnvConfig,
      ) =>
        new RemindersService(
          repo,
          logger,
          queue,
          telemetry,
          organizationService,
          env,
        ),
      inject: [
        RemindersPrismaRepository,
        APP_LOGGER,
        REMINDERS_ENQUEUER,
        REMINDERS_TELEMETRY,
        OrganizationService,
        ENV_CONFIG,
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

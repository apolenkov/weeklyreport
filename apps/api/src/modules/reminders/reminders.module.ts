import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { EMAIL_REMINDER_QUEUE_NAME } from "@weeklyreport/shared";
import type { Queue } from "bullmq";
import { ClsService } from "nestjs-cls";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module";
import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { OrganizationModule } from "../organization/index.js";
import { PolicyApplicatorService } from "./policy-applicator.service.js";
import { REMINDERS_ENQUEUER, REMINDERS_TELEMETRY } from "./reminders.ports.js";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";
import { RemindersBullmqEnqueuer } from "./reminders-bullmq-enqueuer.adapter.js";
import { RemindersPolicyRepairScheduler } from "./reminders-policy-repair.scheduler.js";
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
    RemindersService,
    // Hourly @Cron deadline reminder dispatcher.
    RemindersScheduler,
    PolicyApplicatorService,
    RemindersPolicyRepairScheduler,
    // Periodic @Cron sweep that re-enqueues executions stranded in `queued`.
    RemindersReaperScheduler,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}

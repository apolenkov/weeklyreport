import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { ClsService } from "nestjs-cls";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module";
import { OrganizationModule } from "../organization/organization.module";
import { RemindersPrismaRepository } from "./reminders.prisma-repository";
import { RemindersScheduler } from "./reminders.scheduler";
import { RemindersService } from "./reminders.service";

@Module({
  // UFB-047 / Phase 49-01: `OrganizationModule` exposes `OrganizationService`
  // so the scheduler can snapshot the brand identity onto every BullMQ job.
  imports: [BullMQModule, OrganizationModule],
  providers: [
    RemindersPrismaRepository,
    {
      provide: RemindersService,
      useFactory: (
        repo: RemindersPrismaRepository,
        queue: Queue,
        cls: ClsService,
      ) => new RemindersService(repo, undefined, queue, cls),
      inject: [
        RemindersPrismaRepository,
        getQueueToken("email-reminder"),
        ClsService,
      ],
    },
    // NOTIF-04 (Phase 28-03): hourly @Cron deadline reminder dispatcher.
    RemindersScheduler,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}

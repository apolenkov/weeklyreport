import { Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { BullMQModule } from '../../infrastructure/bullmq/bullmq.module';
import { RemindersService } from './reminders.service';
import { RemindersPrismaRepository } from './reminders.prisma-repository';
import { RemindersScheduler } from './reminders.scheduler';

@Module({
  imports: [BullMQModule],
  providers: [
    RemindersPrismaRepository,
    {
      provide: RemindersService,
      useFactory: (repo: RemindersPrismaRepository, queue: Queue) =>
        new RemindersService(repo, undefined, queue),
      inject: [RemindersPrismaRepository, getQueueToken('email-reminder')],
    },
    // NOTIF-04 (Phase 28-03): hourly @Cron deadline reminder dispatcher.
    RemindersScheduler,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}

import { Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { RemindersService } from './reminders.service';
import { RemindersPrismaRepository } from './reminders.prisma-repository';

@Module({
  providers: [
    RemindersPrismaRepository,
    {
      provide: RemindersService,
      useFactory: (repo: RemindersPrismaRepository, emailQueue: Queue) =>
        new RemindersService(repo, undefined, emailQueue),
      inject: [RemindersPrismaRepository, getQueueToken('email-reminder')],
    },
  ],
  exports: [RemindersService],
})
export class RemindersModule {}

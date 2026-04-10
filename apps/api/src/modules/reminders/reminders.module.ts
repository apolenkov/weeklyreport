import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service.js';
import { RemindersPrismaRepository } from './reminders.prisma-repository.js';

@Module({
  providers: [
    RemindersPrismaRepository,
    {
      provide: RemindersService,
      useFactory: (repo: RemindersPrismaRepository) => new RemindersService(repo),
      inject: [RemindersPrismaRepository],
    },
  ],
  exports: [RemindersService],
})
export class RemindersModule {}

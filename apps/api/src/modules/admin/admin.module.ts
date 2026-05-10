import { Module } from '@nestjs/common';

import { PolicyApplicatorService } from '../reminders/policy-applicator.service';
import { AdminService } from './admin.service';
import { AdminPrismaRepository } from './admin.prisma-repository';

@Module({
  providers: [
    // UFB-036 (Phase 44-03): the policy applicator is the seam that
    // turns ReminderPolicy templates into concrete ReminderRule rows
    // when admin.savePeriod creates a new Period. Provided here (not
    // re-imported from RemindersModule) to keep the cycle tight: admin
    // owns Period.create, so admin owns the post-create hook wiring.
    PolicyApplicatorService,
    AdminPrismaRepository,
    {
      provide: AdminService,
      useFactory: (repo: AdminPrismaRepository) =>
        new AdminService(repo),
      inject: [AdminPrismaRepository],
    },
  ],
  exports: [AdminService],
})
export class AdminModule {}

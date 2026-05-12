import { Module } from '@nestjs/common';

import { PolicyApplicatorService } from '../reminders/policy-applicator.service';
import { AdminService } from './admin.service';
import { AdminPrismaRepository } from './admin.prisma-repository';
import { SessionRevocationService } from './session-revocation.service';

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
    // A2 (UAT-v7 2026-05-12): Redis-backed session revocation for
    // deactivate/activate. Exported so the tRPC router factory can
    // inject it via the NestJS DI container.
    SessionRevocationService,
  ],
  exports: [AdminService, SessionRevocationService],
})
export class AdminModule {}

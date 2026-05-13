import { Module } from "@nestjs/common";
import Redis from "ioredis";

import { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import { AdminService } from "./admin.service";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { SessionRevocationService } from "./session-revocation.service";

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
      useFactory: (repo: AdminPrismaRepository) => new AdminService(repo),
      inject: [AdminPrismaRepository],
    },
    // A2b: satisfy DI so NestJS resolves the Redis type dep; the
    // SessionRevocationService constructor detects null and creates
    // its own ioredis client. Tests override this with a mock client.
    { provide: Redis, useValue: null },
    SessionRevocationService,
  ],
  exports: [AdminService, SessionRevocationService],
})
export class AdminModule {}

import { Module } from "@nestjs/common";

import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { PolicyApplicatorService } from "../reminders/policy-applicator.service";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminService } from "./admin.service";
import { SessionRevocationService } from "./session-revocation.service";

@Module({
  imports: [ConfigModule],
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
    // The service builds its own ioredis client from the validated env when
    // no test client is injected; the factory passes only env so the redis
    // param stays undefined on the production path.
    {
      provide: SessionRevocationService,
      useFactory: (env: EnvConfig) =>
        new SessionRevocationService(undefined, env),
      inject: [ENV_CONFIG],
    },
  ],
  exports: [AdminService, SessionRevocationService],
})
export class AdminModule {}

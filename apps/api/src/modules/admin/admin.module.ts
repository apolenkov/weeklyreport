import { Module } from "@nestjs/common";

import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { PolicyApplicatorService } from "../reminders/index.js";
import { ActionLogPrismaRepository } from "./action-log.prisma-repository";
import { ActionLogService } from "./action-log.service";
import { AdminPrismaRepository } from "./admin.prisma-repository";
import { AdminService } from "./admin.service";
import { SessionRevocationService } from "./session-revocation.service";

@Module({
  imports: [ConfigModule],
  providers: [
    // the policy applicator is the seam that
    // turns ReminderPolicy templates into concrete ReminderRule rows
    // when admin.savePeriod creates a new Period. Provided here (not
    // re-imported from RemindersModule) to keep the cycle tight: admin
    // owns Period.create, so admin owns the post-create hook wiring.
    PolicyApplicatorService,
    AdminPrismaRepository,
    {
      provide: AdminService,
      useFactory: (repo: AdminPrismaRepository, logger: AppLogger) =>
        new AdminService(repo, logger),
      inject: [AdminPrismaRepository, APP_LOGGER],
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
    ActionLogPrismaRepository,
    {
      provide: ActionLogService,
      useFactory: (repo: ActionLogPrismaRepository) =>
        new ActionLogService(repo),
      inject: [ActionLogPrismaRepository],
    },
  ],
  exports: [AdminService, SessionRevocationService, ActionLogService],
})
export class AdminModule {}

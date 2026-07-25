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
import { AdminPrometheusTelemetry } from "./admin-prometheus-telemetry.adapter.js";
import {
  ADMIN_TELEMETRY,
  type AdminTelemetry,
} from "./admin-telemetry.port.js";
import { PeriodAdminService } from "./period-admin.service.js";
import { ProjectAdminService } from "./project-admin.service.js";
import { ReminderAdminService } from "./reminder-admin.service.js";
import { ReopenRequestAdminService } from "./reopen-request-admin.service.js";
import { SessionRevocationService } from "./session-revocation.service";
import { SnapshotAdminService } from "./snapshot-admin.service.js";

const focusedAdminProvider = <T>(
  service: new (repo: AdminPrismaRepository, logger: AppLogger) => T,
) => ({
  provide: service,
  useFactory: (repo: AdminPrismaRepository, logger: AppLogger) =>
    new service(repo, logger),
  inject: [AdminPrismaRepository, APP_LOGGER],
});

@Module({
  imports: [ConfigModule],
  providers: [
    // Admin owns Period.create, so it owns the post-create policy applicator hook
    // (not re-imported from RemindersModule).
    PolicyApplicatorService,
    AdminPrometheusTelemetry,
    { provide: ADMIN_TELEMETRY, useExisting: AdminPrometheusTelemetry },
    AdminPrismaRepository,
    focusedAdminProvider(SnapshotAdminService),
    focusedAdminProvider(ProjectAdminService),
    focusedAdminProvider(ReminderAdminService),
    focusedAdminProvider(PeriodAdminService),
    {
      provide: ReopenRequestAdminService,
      useFactory: (
        repo: AdminPrismaRepository,
        logger: AppLogger,
        telemetry: AdminTelemetry,
      ) => new ReopenRequestAdminService(repo, logger, telemetry),
      inject: [AdminPrismaRepository, APP_LOGGER, ADMIN_TELEMETRY],
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
  exports: [
    SnapshotAdminService,
    ProjectAdminService,
    ReminderAdminService,
    PeriodAdminService,
    ReopenRequestAdminService,
    SessionRevocationService,
    ActionLogService,
  ],
})
export class AdminModule {}

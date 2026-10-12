import { Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuditLogger } from "../../lib/audit-logger.js";
import { APP_LOGGER, AUDIT_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { AdminModule, SnapshotAdminService } from "../admin/index.js";
import { AnalyticsCache, AnalyticsModule } from "../analytics/index.js";
import {
  type AutoCarryOver,
  buildAutoCarryOverDeps,
  carryOverIntoOpenedPeriod,
  CarryOverModule,
  CarryOverPrismaRepository,
  CarryOverService,
} from "../carry-over/index.js";
import { PublicationModule, PublicationService } from "../publication/index.js";
import { PolicyApplicatorService } from "../reminders/index.js";
import { WeeklyReportModule } from "../weekly-report/index.js";
import {
  PERIOD_ANALYTICS_CACHE,
  PERIOD_REPOSITORY,
  PERIOD_SETTINGS,
  PeriodService,
} from "./application/period.service.js";
import { PERIOD_TELEMETRY } from "./application/period-telemetry.port.js";
import { AutoArchiverScheduler } from "./infrastructure/auto-archiver.scheduler.js";
import { AutoPublisherScheduler } from "./infrastructure/auto-publisher.scheduler.js";
import { PeriodPrismaRepository } from "./infrastructure/period.prisma-repository.js";
import {
  PERIOD_AUTO_CARRY_OVER,
  PeriodCreatorScheduler,
} from "./infrastructure/period-creator.scheduler.js";
import { PeriodPrometheusTelemetry } from "./infrastructure/period-prometheus-telemetry.adapter.js";

// Schedulers need ScheduleModule.forRoot() in AppModule and a real AuditLogger
// DI (missing sink fails loud). See openspec/specs/period-scheduler-wiring.
@Module({
  imports: [
    ConfigModule,
    AnalyticsModule,
    AdminModule,
    CarryOverModule,
    PublicationModule,
    WeeklyReportModule,
  ],
  providers: [
    { provide: PERIOD_REPOSITORY, useClass: PeriodPrismaRepository },
    { provide: PERIOD_SETTINGS, useExisting: SnapshotAdminService },
    { provide: PERIOD_ANALYTICS_CACHE, useExisting: AnalyticsCache },
    PeriodPrometheusTelemetry,
    { provide: PERIOD_TELEMETRY, useExisting: PeriodPrometheusTelemetry },
    PeriodService,
    // PolicyApplicatorService provided directly (depends only on PrismaService,
    // no circular dep). Injected into the scheduler so that auto-created periods
    // materialise reminder rules like admin-created ones.
    PolicyApplicatorService,
    {
      provide: PERIOD_AUTO_CARRY_OVER,
      useFactory: (
        prisma: PrismaService,
        carryOverService: CarryOverService,
        carryOverRepository: CarryOverPrismaRepository,
        logger: AppLogger,
      ): AutoCarryOver => {
        // Preserve outcome fields through the same structured logger as bootstrap carry-over.
        const autoCarryOverDeps = buildAutoCarryOverDeps({
          prisma,
          repository: carryOverRepository,
          carryOverService,
          logger: logger.child({ service: "AutoCarryOver" }),
        });
        return (targetReportId) =>
          carryOverIntoOpenedPeriod(autoCarryOverDeps, targetReportId);
      },
      inject: [
        PrismaService,
        CarryOverService,
        CarryOverPrismaRepository,
        APP_LOGGER,
      ],
    },
    PeriodCreatorScheduler,
    {
      provide: AutoPublisherScheduler,
      useFactory: (
        prisma: PrismaService,
        admin: SnapshotAdminService,
        publication: PublicationService,
        auditLogger: AuditLogger,
      ) => new AutoPublisherScheduler(prisma, admin, publication, auditLogger),
      inject: [
        PrismaService,
        SnapshotAdminService,
        PublicationService,
        AUDIT_LOGGER,
      ],
    },
    {
      provide: AutoArchiverScheduler,
      useFactory: (
        prisma: PrismaService,
        admin: SnapshotAdminService,
        auditLogger: AuditLogger,
      ) => new AutoArchiverScheduler(prisma, admin, auditLogger),
      inject: [PrismaService, SnapshotAdminService, AUDIT_LOGGER],
    },
  ],
  // PolicyApplicatorService is exported so the composition root (`main.ts`) can
  // resolve it for the login-time period factory's reminder materialisation.
  exports: [PeriodService, PolicyApplicatorService],
})
export class PeriodModule {}

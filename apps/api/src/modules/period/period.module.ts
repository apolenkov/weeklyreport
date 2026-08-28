import { Logger, Module } from "@nestjs/common";

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
  PERIOD_REPOSITORY,
  type PeriodRepository,
  PeriodService,
} from "./application/period.service.js";
import {
  PERIOD_TELEMETRY,
  type PeriodTelemetry,
} from "./application/period-telemetry.port.js";
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
    AnalyticsModule,
    AdminModule,
    CarryOverModule,
    PublicationModule,
    WeeklyReportModule,
  ],
  providers: [
    { provide: PERIOD_REPOSITORY, useClass: PeriodPrismaRepository },
    PeriodPrometheusTelemetry,
    { provide: PERIOD_TELEMETRY, useExisting: PeriodPrometheusTelemetry },
    {
      provide: PeriodService,
      useFactory: (
        repo: PeriodRepository,
        cache: AnalyticsCache,
        admin: SnapshotAdminService,
        telemetry: PeriodTelemetry,
        logger: AppLogger,
      ) => {
        return new PeriodService(
          repo,
          () => cache.invalidateAll(),
          // Reopen-policy reader resolves the two AppSettings knobs;
          // Settings.get upserts the singleton row, so this stays a single
          // round-trip per reopen call.
          async () => {
            const settings = await admin.getSettings();
            return {
              allowReopenAfterPublish: settings.allowReopenAfterPublish,
              reopenWindowHours: settings.reopenWindowHours,
            };
          },
          telemetry,
          (error) => {
            logger.warn("publish side-effect failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          },
        );
      },
      inject: [
        PERIOD_REPOSITORY,
        AnalyticsCache,
        SnapshotAdminService,
        PERIOD_TELEMETRY,
        APP_LOGGER,
      ],
    },
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
      ): AutoCarryOver => {
        // The carry-over orchestrator logs through a Nest Logger adapter —
        // its deps contract predates APP_LOGGER and expects the Nest shape.
        const nestLogger = new Logger("AutoCarryOver");
        const autoCarryOverDeps = buildAutoCarryOverDeps({
          prisma,
          repository: carryOverRepository,
          carryOverService,
          logger: {
            info: (message, context) => nestLogger.log({ message, ...context }),
            warn: (message, context) =>
              nestLogger.warn({ message, ...context }),
          },
        });
        return (targetReportId) =>
          carryOverIntoOpenedPeriod(autoCarryOverDeps, targetReportId);
      },
      inject: [PrismaService, CarryOverService, CarryOverPrismaRepository],
    },
    {
      provide: PeriodCreatorScheduler,
      useFactory: (
        prisma: PrismaService,
        admin: SnapshotAdminService,
        auditLogger: AuditLogger,
        policyApplicator: PolicyApplicatorService,
        autoCarryOver: AutoCarryOver,
      ) => {
        return new PeriodCreatorScheduler(
          prisma,
          admin,
          auditLogger,
          policyApplicator,
          autoCarryOver,
        );
      },
      inject: [
        PrismaService,
        SnapshotAdminService,
        AUDIT_LOGGER,
        PolicyApplicatorService,
        PERIOD_AUTO_CARRY_OVER,
      ],
    },
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

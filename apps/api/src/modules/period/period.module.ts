import { Logger, Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { AuditLogger } from "../../lib/audit-logger.js";
import { AUDIT_LOGGER } from "../../lib/audit-logger.js";
import { AdminModule } from "../admin/admin.module.js";
import { AdminService } from "../admin/admin.service.js";
import { AnalyticsCache } from "../analytics/analytics.cache.js";
import { AnalyticsModule } from "../analytics/analytics.module.js";
import {
  buildAutoCarryOverDeps,
  carryOverIntoOpenedPeriod,
} from "../carry-over/auto-carry-over.js";
import { CarryOverModule } from "../carry-over/carry-over.module.js";
import { CarryOverPrismaRepository } from "../carry-over/carry-over.prisma-repository.js";
import { CarryOverService } from "../carry-over/carry-over.service.js";
import { PublicationModule } from "../publication/publication.module.js";
import { PublicationService } from "../publication/publication.service.js";
import { PolicyApplicatorService } from "../reminders/policy-applicator.service.js";
import { WeeklyReportModule } from "../weekly-report/weekly-report.module.js";
import { AutoArchiverScheduler } from "./auto-archiver.scheduler.js";
import { AutoPublisherScheduler } from "./auto-publisher.scheduler.js";
import { PeriodPrismaRepository } from "./period.prisma-repository.js";
import { PeriodService } from "./period.service.js";
import { PeriodCreatorScheduler } from "./period-creator.scheduler.js";

/**
 * UFB-049 / Phase 50-B: three scheduler classes (`PeriodCreatorScheduler`,
 * `AutoPublisherScheduler`, `AutoArchiverScheduler`) are wired here. They
 * consume `AdminService` (settings), `PrismaService` (DB), and — for the
 * auto-publisher — `PublicationService` (publishAuto). NestSchedule's
 * `@Cron` decorators in those classes only fire when `ScheduleModule.forRoot()`
 * is present in the root `AppModule` — already wired there for the
 * pre-existing `RemindersScheduler`.
 *
 * Audit envelopes are emitted through the real `AuditLogger`: each scheduler
 * factory injects the `AUDIT_LOGGER` token (config.module.ts), which resolves
 * the AppLogger-backed sink shared with `main.ts`. The arg is required — a
 * missing sink fails DI resolution loudly rather than degrading to a no-op.
 */
@Module({
  imports: [
    AnalyticsModule,
    AdminModule,
    CarryOverModule,
    ConfigModule,
    PublicationModule,
    WeeklyReportModule,
  ],
  providers: [
    PeriodPrismaRepository,
    {
      provide: PeriodService,
      useFactory: (
        repo: PeriodPrismaRepository,
        cache: AnalyticsCache,
        admin: AdminService,
      ) =>
        new PeriodService(
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
          // The AI ingestion module was removed; PeriodService's ingestion
          // hook falls back to its no-op default until the AI rebuild.
        ),
      inject: [PeriodPrismaRepository, AnalyticsCache, AdminService],
    },
    // PolicyApplicatorService provided directly (depends only on PrismaService,
    // no circular dep). Injected into the scheduler so that auto-created periods
    // materialise reminder rules like admin-created ones.
    PolicyApplicatorService,
    {
      provide: PeriodCreatorScheduler,
      useFactory: (
        prisma: PrismaService,
        admin: AdminService,
        auditLogger: AuditLogger,
        policyApplicator: PolicyApplicatorService,
        carryOverService: CarryOverService,
        carryOverRepository: CarryOverPrismaRepository,
      ) => {
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
        return new PeriodCreatorScheduler(
          prisma,
          admin,
          auditLogger,
          policyApplicator,
          (targetReportId) =>
            carryOverIntoOpenedPeriod(autoCarryOverDeps, targetReportId),
        );
      },
      inject: [
        PrismaService,
        AdminService,
        AUDIT_LOGGER,
        PolicyApplicatorService,
        CarryOverService,
        CarryOverPrismaRepository,
      ],
    },
    {
      provide: AutoPublisherScheduler,
      useFactory: (
        prisma: PrismaService,
        admin: AdminService,
        publication: PublicationService,
        auditLogger: AuditLogger,
      ) => new AutoPublisherScheduler(prisma, admin, publication, auditLogger),
      inject: [PrismaService, AdminService, PublicationService, AUDIT_LOGGER],
    },
    {
      provide: AutoArchiverScheduler,
      useFactory: (
        prisma: PrismaService,
        admin: AdminService,
        auditLogger: AuditLogger,
      ) => new AutoArchiverScheduler(prisma, admin, auditLogger),
      inject: [PrismaService, AdminService, AUDIT_LOGGER],
    },
  ],
  // PolicyApplicatorService is exported so the composition root (`main.ts`) can
  // resolve it for the login-time period factory's reminder materialisation.
  exports: [PeriodService, PolicyApplicatorService],
})
export class PeriodModule {}

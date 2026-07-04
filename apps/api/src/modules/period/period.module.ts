import { Logger, Module } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
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
 * Audit envelopes are emitted via the optional `AuditLogger` constructor
 * arg; module-level the schedulers fall back to `createNullAuditLogger()`
 * because the AppLogger-backed audit logger is built once in `main.ts` and
 * is not currently a Nest-DI provider. Phase 51-A or later may promote it
 * to a token-injected provider — for 50-B the null fallback is sufficient
 * (audit data still goes through the Nest `Logger` debug stream).
 */
@Module({
  imports: [
    AnalyticsModule,
    AdminModule,
    CarryOverModule,
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
          // UFB-052 (Phase 51-B): reopen-policy reader resolves to the
          // two `AppSettings` knobs from 51-A. Settings.get already
          // upserts the singleton row so this stays a single round-trip
          // per reopen call.
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
    // Schedulers use explicit factories so the optional AuditLogger
    // constructor arg stays optional under Nest DI. Without the factory,
    // Nest tries to resolve the 3rd parameter and fails because there is
    // no provider for AuditLogger in the graph (it's built in main.ts).
    // Passing `undefined` makes the schedulers fall back to the null
    // audit logger, which routes structured signal through Nest's
    // built-in Logger anyway.
    // TD-06: PolicyApplicatorService provided directly (depends only on
    // PrismaService, no circular dep). Injected into the scheduler so that
    // auto-created periods materialise reminder rules like admin-created ones.
    PolicyApplicatorService,
    {
      provide: PeriodCreatorScheduler,
      useFactory: (
        prisma: PrismaService,
        admin: AdminService,
        policyApplicator: PolicyApplicatorService,
        carryOverService: CarryOverService,
        carryOverRepository: CarryOverPrismaRepository,
      ) => {
        // HF10: the scheduler's auto carry-over hook. AppLogger is not a DI
        // provider (built in main.ts), so the orchestrator logs through a
        // Nest Logger adapter here.
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
          undefined,
          policyApplicator,
          (targetReportId) =>
            carryOverIntoOpenedPeriod(autoCarryOverDeps, targetReportId),
        );
      },
      inject: [
        PrismaService,
        AdminService,
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
      ) => new AutoPublisherScheduler(prisma, admin, publication),
      inject: [PrismaService, AdminService, PublicationService],
    },
    {
      provide: AutoArchiverScheduler,
      useFactory: (prisma: PrismaService, admin: AdminService) =>
        new AutoArchiverScheduler(prisma, admin),
      inject: [PrismaService, AdminService],
    },
  ],
  // PolicyApplicatorService is exported so the composition root (`main.ts`) can
  // resolve it for the login-time period factory's reminder materialisation.
  exports: [PeriodService, PolicyApplicatorService],
})
export class PeriodModule {}

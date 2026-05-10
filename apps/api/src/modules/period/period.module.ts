import { Module } from '@nestjs/common';

import { PeriodService } from './period.service.js';
import { PeriodPrismaRepository } from './period.prisma-repository.js';
import { PeriodCreatorScheduler } from './period-creator.scheduler.js';
import { AutoPublisherScheduler } from './auto-publisher.scheduler.js';
import { AutoArchiverScheduler } from './auto-archiver.scheduler.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AnalyticsCache } from '../analytics/analytics.cache.js';
import { AdminModule } from '../admin/admin.module.js';
import { AdminService } from '../admin/admin.service.js';
import { PublicationModule } from '../publication/publication.module.js';
import { PublicationService } from '../publication/publication.service.js';
import { AiModule } from '../ai/ai.module.js';
import { AiIngestionService } from '../ai/ai-ingestion.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

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
  imports: [AnalyticsModule, AdminModule, PublicationModule, AiModule],
  providers: [
    PeriodPrismaRepository,
    {
      provide: PeriodService,
      useFactory: (
        repo: PeriodPrismaRepository,
        cache: AnalyticsCache,
        admin: AdminService,
        ingestion: AiIngestionService,
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
          // Phase 54 (UFB-055): ingestion hook wired to the
          // AiIngestionService. Fire-and-forget; service swallows
          // its own errors so this hook is effectively infallible
          // from the perspective of the publish path.
          (sectionIds) => ingestion.enqueueSections(sectionIds),
        ),
      inject: [
        PeriodPrismaRepository,
        AnalyticsCache,
        AdminService,
        AiIngestionService,
      ],
    },
    // Schedulers use explicit factories so the optional AuditLogger
    // constructor arg stays optional under Nest DI. Without the factory,
    // Nest tries to resolve the 3rd parameter and fails because there is
    // no provider for AuditLogger in the graph (it's built in main.ts).
    // Passing `undefined` makes the schedulers fall back to the null
    // audit logger, which routes structured signal through Nest's
    // built-in Logger anyway.
    {
      provide: PeriodCreatorScheduler,
      useFactory: (prisma: PrismaService, admin: AdminService) =>
        new PeriodCreatorScheduler(prisma, admin),
      inject: [PrismaService, AdminService],
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
  exports: [PeriodService],
})
export class PeriodModule {}

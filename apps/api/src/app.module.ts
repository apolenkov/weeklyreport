import { Module } from '@nestjs/common';
import type {
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { BullMQModule } from './infrastructure/bullmq/bullmq.module';
import { HealthModule } from './infrastructure/health/health.module';
import { MetricsModule } from './infrastructure/metrics/metrics.module';
import { CorrelationIdMiddleware } from './infrastructure/middleware/correlation-id.middleware';
import { ReviewModule } from './modules/review/review.module';
import { ArchiveModule } from './modules/archive/archive.module';
import { PdfExportModule } from './modules/pdf-export/pdf-export.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { ReportSectionsModule } from './modules/report-sections/report-sections.module';
import { PublicationModule } from './modules/publication/publication.module';
import { CarryOverModule } from './modules/carry-over/carry-over.module';
import { AdminModule } from './modules/admin/admin.module';
import { PeriodModule } from './modules/period/period.module';
import { WeeklyReportModule } from './modules/weekly-report/weekly-report.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';
import { PdfExportProcessor } from './infrastructure/bullmq/pdf-export.processor';
import { EmailReminderProcessor } from './infrastructure/bullmq/email-reminder.processor';
import { EmailService } from './infrastructure/email/email.service';
import { assertNoDevAuthInProduction } from './lib/dev-auth-fence';

@Module({
  imports: [
    // ClsModule with mount=false because the raw Express handlers (/trpc,
    // /pdfs static, SAML auth routes) are not registered via Nest's router,
    // so consumer.apply(...).forRoutes('*') never wraps them. Both
    // ClsMiddleware AND CorrelationIdMiddleware are mounted via app.use()
    // in main.ts so all paths — controller, raw Express, tRPC — share the
    // same AsyncLocalStorage scope.
    ClsModule.forRoot({
      global: true,
      middleware: { mount: false, generateId: false },
    }),
    // NOTIF-04 (Phase 28-03): hourly @Cron tick for deadline reminder dispatch.
    // ScheduleModule.forRoot() must be present for `@Cron(...)` decorators on
    // any provider in the module graph (e.g. RemindersScheduler) to fire.
    ScheduleModule.forRoot(),
    PrismaModule,
    BullMQModule,
    HealthModule,
    MetricsModule,
    ReviewModule,
    ArchiveModule,
    PdfExportModule,
    RemindersModule,
    ReportSectionsModule,
    PublicationModule,
    CarryOverModule,
    AdminModule,
    AnalyticsModule,
    AiModule,
    PeriodModule,
    WeeklyReportModule,
  ],
  providers: [
    PdfExportProcessor,
    EmailReminderProcessor,
    EmailService,
    CorrelationIdMiddleware,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  /**
   * AUTH-01 (Phase 29-04 / Phase 32-C M-05): boot-time dev-auth fence.
   *
   * Lives on `OnApplicationBootstrap` instead of `bootstrap()` in main.ts so
   * every consumer of `NestFactory.create(AppModule)` (e2e suites, CLI tools,
   * Nest test harness) sees the same fail-closed behaviour. The fence is a
   * no-op when NODE_ENV !== 'production', so test/dev paths are unaffected.
   */
  onApplicationBootstrap(): void {
    assertNoDevAuthInProduction(process.env);
  }
}

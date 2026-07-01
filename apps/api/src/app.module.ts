import type { OnApplicationBootstrap } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ClsModule } from "nestjs-cls";

import { BullMQModule } from "./infrastructure/bullmq/bullmq.module";
import { EmailReminderProcessor } from "./infrastructure/bullmq/email-reminder.processor";
import { PdfExportProcessor } from "./infrastructure/bullmq/pdf-export.processor";
import { ConfigModule } from "./infrastructure/config/config.module";
import { EmailService } from "./infrastructure/email/email.service";
import { HealthModule } from "./infrastructure/health/health.module";
import { MetricsModule } from "./infrastructure/metrics/metrics.module";
import { CorrelationIdMiddleware } from "./infrastructure/middleware/correlation-id.middleware";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { assertNoDevAuthInProduction } from "./lib/dev-auth-fence";
import { ActivityModule } from "./modules/activity/activity.module";
import { AdminModule } from "./modules/admin/admin.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { ArchiveModule } from "./modules/archive/archive.module";
import { CarryOverModule } from "./modules/carry-over/carry-over.module";
import { ObservabilityModule } from "./modules/observability/observability.module.js";
import { OrganizationModule } from "./modules/organization/organization.module";
import { PdfExportModule } from "./modules/pdf-export/pdf-export.module";
import { PeriodModule } from "./modules/period/period.module";
import { PublicationModule } from "./modules/publication/publication.module";
import { RemindersModule } from "./modules/reminders/reminders.module";
import { ReportSectionsModule } from "./modules/report-sections/report-sections.module";
import { ReviewModule } from "./modules/review/review.module";
import { SearchModule } from "./modules/search/search.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { TelemetryModule } from "./modules/telemetry/telemetry.module";
import { WeeklyReportModule } from "./modules/weekly-report/weekly-report.module";

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
    ConfigModule,
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
    OrganizationModule,
    AnalyticsModule,
    SearchModule,
    ActivityModule,
    TelemetryModule,
    PeriodModule,
    WeeklyReportModule,
    // UFB-056 / Phase 55-3: Telegram outbound queue + adapter seam.
    // Seeds-only — MockTelegramAdapter unless TG_BOT_TOKEN is set, in
    // which case selectTelegramAdapter throws at boot.
    TelegramModule,
    ObservabilityModule,
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

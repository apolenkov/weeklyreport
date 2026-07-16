import type { OnApplicationBootstrap } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ClsModule, ClsService } from "nestjs-cls";

import { BullMQModule } from "./infrastructure/bullmq/bullmq.module";
import { EmailReminderProcessor } from "./infrastructure/bullmq/email-reminder.processor";
import { PdfExportProcessor } from "./infrastructure/bullmq/pdf-export.processor";
import { createWorkerLogger } from "./infrastructure/bullmq/worker-observability.js";
import {
  ConfigModule,
  ENV_CONFIG,
} from "./infrastructure/config/config.module";
import type { EnvConfig } from "./infrastructure/config/env.schema";
import type { EmailPort } from "./infrastructure/email/email.service";
import { EMAIL_PORT, EmailService } from "./infrastructure/email/email.service";
import { HealthModule } from "./infrastructure/health/health.module";
import { MetricsModule } from "./infrastructure/metrics/metrics.module";
import { CorrelationIdMiddleware } from "./infrastructure/middleware/correlation-id.middleware";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { assertNoDevAuthInProduction } from "./lib/dev-auth-fence";
import { ActivityModule } from "./modules/activity/index.js";
import { AdminModule } from "./modules/admin/index.js";
import { SnapshotAdminService } from "./modules/admin/index.js";
import { AnalyticsModule } from "./modules/analytics/index.js";
import { ArchiveModule } from "./modules/archive/index.js";
import { CarryOverModule } from "./modules/carry-over/index.js";
import { ObservabilityModule } from "./modules/observability/index.js";
import { OrganizationModule } from "./modules/organization/index.js";
import { PdfExportModule } from "./modules/pdf-export/index.js";
import { PdfExportService } from "./modules/pdf-export/index.js";
import { PeriodModule } from "./modules/period/index.js";
import { ProjectActivityModule } from "./modules/project-activity/index.js";
import { PublicationModule } from "./modules/publication/index.js";
import { RemindersModule } from "./modules/reminders/index.js";
import { RemindersService } from "./modules/reminders/index.js";
import { ReportSectionsModule } from "./modules/report-sections/index.js";
import { ReviewModule } from "./modules/review/index.js";
import { SearchModule } from "./modules/search/index.js";
import { TelegramModule } from "./modules/telegram/index.js";
import { TelemetryModule } from "./modules/telemetry/index.js";
import { WeeklyReportModule } from "./modules/weekly-report/index.js";

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
    // Hourly @Cron tick for deadline reminder dispatch.
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
    ProjectActivityModule,
    TelemetryModule,
    PeriodModule,
    WeeklyReportModule,
    // Telegram outbound queue + adapter seam.
    // Seeds-only — MockTelegramAdapter unless TG_BOT_TOKEN is set, in
    // which case selectTelegramAdapter throws at boot.
    TelegramModule,
    ObservabilityModule,
  ],
  providers: [
    {
      provide: PdfExportProcessor,
      useFactory: (
        pdfExportService: PdfExportService,
        env: EnvConfig,
        cls: ClsService,
      ) =>
        new PdfExportProcessor(
          pdfExportService,
          env,
          createWorkerLogger("pdf-export-worker", cls),
          cls,
        ),
      inject: [PdfExportService, ENV_CONFIG, ClsService],
    },
    {
      provide: EmailReminderProcessor,
      useFactory: (
        remindersService: RemindersService,
        emailService: EmailPort,
        env: EnvConfig,
        snapshotAdminService: SnapshotAdminService,
        cls: ClsService,
      ) =>
        new EmailReminderProcessor(
          remindersService,
          emailService,
          env,
          snapshotAdminService,
          createWorkerLogger("email-reminder-worker", cls),
          cls,
        ),
      inject: [
        RemindersService,
        EMAIL_PORT,
        ENV_CONFIG,
        SnapshotAdminService,
        ClsService,
      ],
    },
    EmailService,
    { provide: EMAIL_PORT, useExisting: EmailService },
    CorrelationIdMiddleware,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  /**
   * Boot-time dev-auth fence.
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

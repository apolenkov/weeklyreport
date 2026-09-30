import type { OnApplicationBootstrap } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ClsModule } from "nestjs-cls";

import { BullMQModule } from "./infrastructure/bullmq/bullmq.module";
import { EmailReminderProcessor } from "./infrastructure/bullmq/email-reminder.processor";
import { PdfExportProcessor } from "./infrastructure/bullmq/pdf-export.processor";
import { PdfExportReconciliationScheduler } from "./infrastructure/bullmq/pdf-export-reconciliation.scheduler.js";
import { ConfigModule } from "./infrastructure/config/config.module";
import { EMAIL_PORT, EmailService } from "./infrastructure/email/email.service";
import { HealthModule } from "./infrastructure/health/health.module";
import { MetricsModule } from "./infrastructure/metrics/metrics.module";
import { CorrelationIdMiddleware } from "./infrastructure/middleware/correlation-id.middleware";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import { assertNoDevAuthInProduction } from "./lib/dev-auth-fence";
import { ActivityModule } from "./modules/activity/index.js";
import { AdminModule } from "./modules/admin/index.js";
import { AnalyticsModule } from "./modules/analytics/index.js";
import { ArchiveModule } from "./modules/archive/index.js";
import { CarryOverModule } from "./modules/carry-over/index.js";
import { ObservabilityModule } from "./modules/observability/index.js";
import { OrganizationModule } from "./modules/organization/index.js";
import { PdfExportModule } from "./modules/pdf-export/index.js";
import { PeriodModule } from "./modules/period/module.js";
import { ProjectActivityModule } from "./modules/project-activity/index.js";
import { PublicationModule } from "./modules/publication/index.js";
import { RemindersModule } from "./modules/reminders/index.js";
import { ReportSectionsModule } from "./modules/report-sections/index.js";
import { ReviewModule } from "./modules/review/index.js";
import { SearchModule } from "./modules/search/index.js";
import { TelemetryModule } from "./modules/telemetry/index.js";
import { WeeklyReportModule } from "./modules/weekly-report/index.js";

@Module({
  imports: [
    // ClsModule with mount=false: raw Express handlers (/trpc, /pdfs, SAML)
    // bypass Nest's router, so ClsMiddleware + CorrelationIdMiddleware are
    // mounted via app.use() in main.ts to share one AsyncLocalStorage scope.
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
    ObservabilityModule,
  ],
  providers: [
    PdfExportProcessor,
    PdfExportReconciliationScheduler,
    EmailReminderProcessor,
    EmailService,
    { provide: EMAIL_PORT, useExisting: EmailService },
    CorrelationIdMiddleware,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  // Runs from the lifecycle hook so every `NestFactory.create(AppModule)`
  // consumer (e2e, CLI, test harness) gets the same fail-closed fence.
  onApplicationBootstrap(): void {
    assertNoDevAuthInProduction(process.env);
  }
}

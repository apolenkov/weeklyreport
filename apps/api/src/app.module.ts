import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
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
import { PdfExportProcessor } from './infrastructure/bullmq/pdf-export.processor';
import { EmailReminderProcessor } from './infrastructure/bullmq/email-reminder.processor';
import { EmailService } from './infrastructure/email/email.service';

@Module({
  imports: [
    // ClsModule must be first so its AsyncLocalStorage middleware mounts
    // before CorrelationIdMiddleware writes into the active store.
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: false },
    }),
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
    PeriodModule,
    WeeklyReportModule,
  ],
  providers: [PdfExportProcessor, EmailReminderProcessor, EmailService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

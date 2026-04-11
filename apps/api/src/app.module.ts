import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
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
import { PdfExportProcessor } from './infrastructure/bullmq/pdf-export.processor';
import { EmailReminderProcessor } from './infrastructure/bullmq/email-reminder.processor';
import { EmailService } from './infrastructure/email/email.service';

@Module({
  imports: [
    PrismaModule,
    // TODO: BullModule disabled temporarily — @nestjs/bullmq BullExplorer ModuleRef bug
    // BullModule.forRoot({ connection: { host: process.env['REDIS_HOST'] ?? 'localhost', port: Number(process.env['REDIS_PORT'] ?? 6379), maxRetriesPerRequest: null } }),
    // BullModule.registerQueue({ name: 'pdf-export' }),
    // BullModule.registerQueue({ name: 'email-reminder' }),
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
  ],
  // TODO: Re-enable when BullMQ DI issue is resolved
  // providers: [PdfExportProcessor, EmailReminderProcessor, EmailService],
  providers: [EmailService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

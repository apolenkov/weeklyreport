import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { HealthModule } from './infrastructure/health/health.module.js';
import { MetricsModule } from './infrastructure/metrics/metrics.module.js';
import { CorrelationIdMiddleware } from './infrastructure/middleware/correlation-id.middleware.js';
import { ReviewModule } from './modules/review/review.module.js';
import { ArchiveModule } from './modules/archive/archive.module.js';
import { PdfExportModule } from './modules/pdf-export/pdf-export.module.js';
import { RemindersModule } from './modules/reminders/reminders.module.js';
import { ReportSectionsModule } from './modules/report-sections/report-sections.module';
import { PublicationModule } from './modules/publication/publication.module';
import { CarryOverModule } from './modules/carry-over/carry-over.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    PrismaModule,
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
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}

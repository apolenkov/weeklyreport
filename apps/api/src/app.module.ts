import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { ReviewModule } from './modules/review/review.module.js';
import { ArchiveModule } from './modules/archive/archive.module.js';
import { PdfExportModule } from './modules/pdf-export/pdf-export.module.js';
import { RemindersModule } from './modules/reminders/reminders.module.js';

@Module({
  imports: [
    PrismaModule,
    ReviewModule,
    ArchiveModule,
    PdfExportModule,
    RemindersModule,
    // Plan 03 adds: ReportSectionsModule, PublicationModule, CarryOverModule, AdminModule
  ],
})
export class AppModule {}

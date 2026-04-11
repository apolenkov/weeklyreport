import { Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PdfExportService } from './pdf-export.service';
import { PdfExportPrismaRepository } from './pdf-export.prisma-repository';

@Module({
  providers: [
    PdfExportPrismaRepository,
    {
      provide: PdfExportService,
      useFactory: (repo: PdfExportPrismaRepository, pdfQueue: Queue) =>
        new PdfExportService(repo, undefined, pdfQueue),
      inject: [PdfExportPrismaRepository, getQueueToken('pdf-export')],
    },
  ],
  exports: [PdfExportService],
})
export class PdfExportModule {}

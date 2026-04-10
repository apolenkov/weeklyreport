import { Module } from '@nestjs/common';
import { PdfExportService } from './pdf-export.service.js';
import { PdfExportPrismaRepository } from './pdf-export.prisma-repository.js';

@Module({
  providers: [
    PdfExportPrismaRepository,
    {
      provide: PdfExportService,
      useFactory: (repo: PdfExportPrismaRepository) => new PdfExportService(repo),
      inject: [PdfExportPrismaRepository],
    },
  ],
  exports: [PdfExportService],
})
export class PdfExportModule {}

import { Module } from '@nestjs/common';
import { PdfExportService } from './pdf-export.service';
import { PdfExportPrismaRepository } from './pdf-export.prisma-repository';

@Module({
  providers: [
    PdfExportPrismaRepository,
    {
      provide: PdfExportService,
      useFactory: (repo: PdfExportPrismaRepository) =>
        new PdfExportService(repo),
      inject: [PdfExportPrismaRepository],
    },
  ],
  exports: [PdfExportService],
})
export class PdfExportModule {}

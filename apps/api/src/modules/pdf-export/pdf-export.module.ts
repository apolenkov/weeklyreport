import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";
import { PdfExportService } from "./pdf-export.service";

@Module({
  imports: [BullMQModule],
  providers: [
    PdfExportPrismaRepository,
    {
      provide: PdfExportService,
      useFactory: (repo: PdfExportPrismaRepository, queue: Queue) =>
        new PdfExportService(repo, undefined, queue),
      inject: [PdfExportPrismaRepository, getQueueToken("pdf-export")],
    },
  ],
  exports: [PdfExportService],
})
export class PdfExportModule {}

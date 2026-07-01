import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { ClsService } from "nestjs-cls";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";
import { PdfExportService } from "./pdf-export.service";

@Module({
  imports: [BullMQModule],
  providers: [
    PdfExportPrismaRepository,
    {
      provide: PdfExportService,
      useFactory: (
        repo: PdfExportPrismaRepository,
        queue: Queue,
        cls: ClsService,
      ) => new PdfExportService(repo, undefined, queue, cls),
      inject: [
        PdfExportPrismaRepository,
        getQueueToken("pdf-export"),
        ClsService,
      ],
    },
  ],
  exports: [PdfExportService],
})
export class PdfExportModule {}

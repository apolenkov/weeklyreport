import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { ClsService } from "nestjs-cls";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module";
import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";
import { PdfExportService } from "./pdf-export.service";

@Module({
  imports: [BullMQModule, ConfigModule],
  providers: [
    PdfExportPrismaRepository,
    {
      provide: PdfExportService,
      useFactory: (
        repo: PdfExportPrismaRepository,
        logger: AppLogger,
        queue: Queue,
        cls: ClsService,
      ) => new PdfExportService(repo, logger, queue, cls),
      inject: [
        PdfExportPrismaRepository,
        APP_LOGGER,
        getQueueToken("pdf-export"),
        ClsService,
      ],
    },
  ],
  exports: [PdfExportService],
})
export class PdfExportModule {}

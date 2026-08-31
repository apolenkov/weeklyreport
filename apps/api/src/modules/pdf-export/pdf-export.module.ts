import { PDF_EXPORT_QUEUE_NAME } from "@customreport/shared";
import { getQueueToken } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import type { Queue } from "bullmq";
import { ClsService } from "nestjs-cls";

import { BullMQModule } from "../../infrastructure/bullmq/bullmq.module";
import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import {
  PDF_EXPORT_ENQUEUER,
  PDF_EXPORT_TELEMETRY,
  type PdfExportEnqueuer,
  type PdfExportTelemetry,
} from "./pdf-export.ports.js";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";
import { PdfExportService } from "./pdf-export.service";
import { PdfExportBullmqEnqueuer } from "./pdf-export-bullmq-enqueuer.adapter.js";
import { PdfExportInfrastructureTelemetry } from "./pdf-export-telemetry.adapter.js";

@Module({
  imports: [BullMQModule, ConfigModule],
  providers: [
    PdfExportPrismaRepository,
    {
      provide: PDF_EXPORT_ENQUEUER,
      useFactory: (queue: Queue) => new PdfExportBullmqEnqueuer(queue),
      inject: [getQueueToken(PDF_EXPORT_QUEUE_NAME)],
    },
    {
      provide: PDF_EXPORT_TELEMETRY,
      useFactory: (cls: ClsService) =>
        new PdfExportInfrastructureTelemetry(cls),
      inject: [ClsService],
    },
    {
      provide: PdfExportService,
      useFactory: (
        repo: PdfExportPrismaRepository,
        logger: AppLogger,
        queue: PdfExportEnqueuer,
        telemetry: PdfExportTelemetry,
        env: EnvConfig,
      ) => new PdfExportService(repo, logger, queue, telemetry, env),
      inject: [
        PdfExportPrismaRepository,
        APP_LOGGER,
        PDF_EXPORT_ENQUEUER,
        PDF_EXPORT_TELEMETRY,
        ENV_CONFIG,
      ],
    },
  ],
  exports: [PdfExportService],
})
export class PdfExportModule {}

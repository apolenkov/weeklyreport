import { Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { AnalyticsCache, AnalyticsModule } from "../analytics/index.js";
import {
  PUBLICATION_REPOSITORY,
  type PublicationRepository,
  PublicationService,
} from "./application/publication.service";
import {
  PUBLICATION_TELEMETRY,
  type PublicationTelemetry,
} from "./application/publication-telemetry.port.js";
import { PublicationPrismaRepository } from "./infrastructure/publication.prisma-repository";
import { PublicationPrometheusTelemetry } from "./infrastructure/publication-prometheus-telemetry.adapter.js";

@Module({
  imports: [AnalyticsModule, ConfigModule],
  providers: [
    { provide: PUBLICATION_REPOSITORY, useClass: PublicationPrismaRepository },
    PublicationPrometheusTelemetry,
    {
      provide: PUBLICATION_TELEMETRY,
      useExisting: PublicationPrometheusTelemetry,
    },
    {
      provide: PublicationService,
      useFactory: (
        repo: PublicationRepository,
        analyticsCache: AnalyticsCache,
        telemetry: PublicationTelemetry,
        logger: AppLogger,
      ) =>
        new PublicationService(
          repo,
          logger.child({ service: "PublicationService" }),
          () => analyticsCache.invalidateAll(),
          telemetry,
        ),
      inject: [
        PUBLICATION_REPOSITORY,
        AnalyticsCache,
        PUBLICATION_TELEMETRY,
        APP_LOGGER,
      ],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}

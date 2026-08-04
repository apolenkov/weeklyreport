import { Module } from "@nestjs/common";

import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { createServiceLogger } from "../../lib/logger-service.js";
import { AnalyticsCache, AnalyticsModule } from "../analytics/index.js";
import {
  NoopIngestionQueue,
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
      provide: NoopIngestionQueue,
      useFactory: (env: EnvConfig, logger: AppLogger) =>
        new NoopIngestionQueue(logger, env.NODE_ENV),
      inject: [ENV_CONFIG, APP_LOGGER],
    },
    {
      provide: PublicationService,
      useFactory: (
        repo: PublicationRepository,
        ingestionQueue: NoopIngestionQueue,
        analyticsCache: AnalyticsCache,
        telemetry: PublicationTelemetry,
      ) =>
        new PublicationService(
          repo,
          createServiceLogger("PublicationService"),
          ingestionQueue,
          () => analyticsCache.invalidateAll(),
          telemetry,
        ),
      inject: [
        PUBLICATION_REPOSITORY,
        NoopIngestionQueue,
        AnalyticsCache,
        PUBLICATION_TELEMETRY,
      ],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}

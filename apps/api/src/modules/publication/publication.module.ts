import { Module } from "@nestjs/common";

import { createServiceLogger } from "../../lib/logger-service.js";
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
  imports: [AnalyticsModule],
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
      ) =>
        new PublicationService(
          repo,
          createServiceLogger("PublicationService"),
          () => analyticsCache.invalidateAll(),
          telemetry,
        ),
      inject: [PUBLICATION_REPOSITORY, AnalyticsCache, PUBLICATION_TELEMETRY],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}

import { Module } from "@nestjs/common";

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
  providers: [
    { provide: PUBLICATION_REPOSITORY, useClass: PublicationPrismaRepository },
    PublicationPrometheusTelemetry,
    {
      provide: PUBLICATION_TELEMETRY,
      useExisting: PublicationPrometheusTelemetry,
    },
    NoopIngestionQueue,
    {
      provide: PublicationService,
      useFactory: (
        repo: PublicationRepository,
        ingestionQueue: NoopIngestionQueue,
        telemetry: PublicationTelemetry,
      ) => new PublicationService(repo, undefined, ingestionQueue, telemetry),
      inject: [
        PUBLICATION_REPOSITORY,
        NoopIngestionQueue,
        PUBLICATION_TELEMETRY,
      ],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}

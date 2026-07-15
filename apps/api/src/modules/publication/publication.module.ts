import { Module } from "@nestjs/common";

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
  // The AI ingestion module was removed. PublicationService keeps its
  // optional ingestion hook, which now falls back to its no-op default;
  // the rebuilt AI module re-wires it.
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
        telemetry: PublicationTelemetry,
      ) => new PublicationService(repo, undefined, undefined, telemetry),
      inject: [PUBLICATION_REPOSITORY, PUBLICATION_TELEMETRY],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}

import { Module } from "@nestjs/common";

import {
  PUBLICATION_REPOSITORY,
  type PublicationRepository,
  PublicationService,
} from "./application/publication.service";
import { PublicationPrismaRepository } from "./infrastructure/publication.prisma-repository";

@Module({
  // The AI ingestion module was removed. PublicationService keeps its
  // optional ingestion hook, which now falls back to its no-op default;
  // the rebuilt AI module re-wires it.
  providers: [
    { provide: PUBLICATION_REPOSITORY, useClass: PublicationPrismaRepository },
    {
      provide: PublicationService,
      useFactory: (repo: PublicationRepository) => new PublicationService(repo),
      inject: [PUBLICATION_REPOSITORY],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}

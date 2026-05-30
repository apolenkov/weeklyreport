import { Module } from "@nestjs/common";

import { PublicationPrismaRepository } from "./publication.prisma-repository";
import { PublicationService } from "./publication.service";

@Module({
  // The AI ingestion module was removed (see
  // apps/api/src/modules/ai/HANDOFF.md). PublicationService keeps its
  // optional ingestion hook, which now falls back to its no-op default;
  // the rebuilt AI module re-wires it.
  providers: [
    PublicationPrismaRepository,
    {
      provide: PublicationService,
      useFactory: (repo: PublicationPrismaRepository) =>
        new PublicationService(repo),
      inject: [PublicationPrismaRepository],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}

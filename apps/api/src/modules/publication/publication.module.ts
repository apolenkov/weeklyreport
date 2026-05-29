import { Module } from "@nestjs/common";

import { AiModule } from "../ai/ai.module.js";
import { AiIngestionService } from "../ai/ai-ingestion.service.js";
import { PublicationPrismaRepository } from "./publication.prisma-repository";
import { PublicationService } from "./publication.service";

@Module({
  // Phase 54 (UFB-055): AiModule provides AiIngestionService; the
  // ingestion hook is fire-and-forget and never breaks the publish
  // path even when AI infra is degraded.
  imports: [AiModule],
  providers: [
    PublicationPrismaRepository,
    {
      provide: PublicationService,
      useFactory: (
        repo: PublicationPrismaRepository,
        ingestion: AiIngestionService,
      ) =>
        new PublicationService(repo, undefined, (sectionIds) =>
          ingestion.enqueueSections(sectionIds),
        ),
      inject: [PublicationPrismaRepository, AiIngestionService],
    },
  ],
  exports: [PublicationService],
})
export class PublicationModule {}

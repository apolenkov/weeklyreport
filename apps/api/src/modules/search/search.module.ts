import { Module } from "@nestjs/common";

import { SearchPrismaRepository } from "./search.prisma-repository.js";
import { SearchService } from "./search.service.js";

/**
 * 39-05 (PERF-05): full-text search wired through the same repository
 * pattern as analytics / archive — Prisma-free service boundary, Prisma
 * implementation injected via NestJS DI.
 */
@Module({
  providers: [
    SearchPrismaRepository,
    {
      provide: SearchService,
      useFactory: (repo: SearchPrismaRepository) => new SearchService(repo),
      inject: [SearchPrismaRepository],
    },
  ],
  exports: [SearchService],
})
export class SearchModule {}

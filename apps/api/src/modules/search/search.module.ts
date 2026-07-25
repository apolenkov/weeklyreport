import { Module } from "@nestjs/common";

import { SearchPrismaRepository } from "./search.prisma-repository.js";
import { SearchService } from "./search.service.js";

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

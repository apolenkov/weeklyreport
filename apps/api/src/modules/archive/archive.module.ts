import { Module } from "@nestjs/common";
import { ArchivePrismaRepository } from "./archive.prisma-repository.js";
import { ArchiveService } from "./archive.service.js";

@Module({
  providers: [
    ArchivePrismaRepository,
    {
      provide: ArchiveService,
      useFactory: (repo: ArchivePrismaRepository) => new ArchiveService(repo),
      inject: [ArchivePrismaRepository],
    },
  ],
  exports: [ArchiveService],
})
export class ArchiveModule {}

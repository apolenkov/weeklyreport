import { Module } from "@nestjs/common";

import { ProjectActivityPrismaRepository } from "./project-activity.prisma-repository.js";
import { ProjectActivityService } from "./project-activity.service.js";

@Module({
  providers: [
    ProjectActivityPrismaRepository,
    {
      provide: ProjectActivityService,
      useFactory: (repo: ProjectActivityPrismaRepository) =>
        new ProjectActivityService(repo),
      inject: [ProjectActivityPrismaRepository],
    },
  ],
  exports: [ProjectActivityService],
})
export class ProjectActivityModule {}

import { Module } from "@nestjs/common";
import { ActivityPrismaRepository } from "./activity.prisma-repository.js";
import { ActivityService } from "./activity.service.js";

@Module({
  providers: [
    ActivityPrismaRepository,
    {
      provide: ActivityService,
      useFactory: (repo: ActivityPrismaRepository) => new ActivityService(repo),
      inject: [ActivityPrismaRepository],
    },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}

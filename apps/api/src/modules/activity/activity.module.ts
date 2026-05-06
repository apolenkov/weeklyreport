import { Module } from '@nestjs/common';

import { ActivityService } from './activity.service.js';
import { ActivityPrismaRepository } from './activity.prisma-repository.js';

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

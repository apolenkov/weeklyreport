import { Module } from "@nestjs/common";

import { AnalyticsCache } from "./analytics.cache.js";
import { AnalyticsPrismaRepository } from "./analytics.prisma-repository.js";
import { AnalyticsService } from "./analytics.service.js";

@Module({
  providers: [
    AnalyticsCache,
    AnalyticsPrismaRepository,
    {
      provide: AnalyticsService,
      useFactory: (repo: AnalyticsPrismaRepository, cache: AnalyticsCache) =>
        new AnalyticsService(repo, cache),
      inject: [AnalyticsPrismaRepository, AnalyticsCache],
    },
  ],
  exports: [AnalyticsService, AnalyticsCache],
})
export class AnalyticsModule {}

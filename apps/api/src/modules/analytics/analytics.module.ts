import { Module } from "@nestjs/common";

import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { AnalyticsCache } from "./analytics.cache.js";
import { AnalyticsPrismaRepository } from "./analytics.prisma-repository.js";
import { AnalyticsService } from "./analytics.service.js";

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AnalyticsCache,
      useFactory: (env: EnvConfig) => new AnalyticsCache(env),
      inject: [ENV_CONFIG],
    },
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

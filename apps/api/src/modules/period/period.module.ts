import { Module } from '@nestjs/common';

import { PeriodService } from './period.service.js';
import { PeriodPrismaRepository } from './period.prisma-repository.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { AnalyticsCache } from '../analytics/analytics.cache.js';

@Module({
  imports: [AnalyticsModule],
  providers: [
    PeriodPrismaRepository,
    {
      provide: PeriodService,
      useFactory: (repo: PeriodPrismaRepository, cache: AnalyticsCache) =>
        new PeriodService(repo, () => cache.invalidateAll()),
      inject: [PeriodPrismaRepository, AnalyticsCache],
    },
  ],
  exports: [PeriodService],
})
export class PeriodModule {}

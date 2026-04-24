import { Module } from '@nestjs/common';

import { PeriodService } from './period.service.js';
import { PeriodPrismaRepository } from './period.prisma-repository.js';

@Module({
  providers: [
    PeriodPrismaRepository,
    {
      provide: PeriodService,
      useFactory: (repo: PeriodPrismaRepository) => new PeriodService(repo),
      inject: [PeriodPrismaRepository],
    },
  ],
  exports: [PeriodService],
})
export class PeriodModule {}

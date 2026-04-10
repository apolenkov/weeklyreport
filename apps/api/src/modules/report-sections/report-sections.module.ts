import { Module } from '@nestjs/common';

import { ReportSectionsService } from './report-sections.service';
import { ReportSectionsPrismaRepository } from './report-sections.prisma-repository';

@Module({
  providers: [
    ReportSectionsPrismaRepository,
    {
      provide: ReportSectionsService,
      useFactory: (repo: ReportSectionsPrismaRepository) =>
        new ReportSectionsService(repo),
      inject: [ReportSectionsPrismaRepository],
    },
  ],
  exports: [ReportSectionsService],
})
export class ReportSectionsModule {}

import { Module } from '@nestjs/common';

import { ReportSectionsService } from './report-sections.service';
import { ReportSectionsPrismaRepository } from './report-sections.prisma-repository';
import { LeadFormService } from './lead-form.service';
import { LeadFormPrismaRepository } from './lead-form.prisma-repository';

@Module({
  providers: [
    ReportSectionsPrismaRepository,
    LeadFormPrismaRepository,
    {
      provide: ReportSectionsService,
      useFactory: (repo: ReportSectionsPrismaRepository) =>
        new ReportSectionsService(repo),
      inject: [ReportSectionsPrismaRepository],
    },
    {
      provide: LeadFormService,
      useFactory: (repo: LeadFormPrismaRepository) =>
        new LeadFormService(repo),
      inject: [LeadFormPrismaRepository],
    },
  ],
  exports: [ReportSectionsService, LeadFormService],
})
export class ReportSectionsModule {}

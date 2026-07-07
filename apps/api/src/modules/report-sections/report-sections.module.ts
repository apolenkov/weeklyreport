import { Module } from "@nestjs/common";

import { AdminModule, AdminService } from "../admin/index.js";
import {
  LEAD_FORM_REPOSITORY,
  type LeadFormRepository,
  LeadFormService,
} from "./application/lead-form.service";
import {
  REPORT_SECTIONS_REPOSITORY,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./application/report-sections.service";
import { LeadFormPrismaRepository } from "./infrastructure/lead-form.prisma-repository";
import { ReportSectionsPrismaRepository } from "./infrastructure/report-sections.prisma-repository";

@Module({
  // AdminModule is imported so ReportSectionsService can read
  // `gracePeriodHours` + `allowLateSubmissions` from the AppSettings singleton
  // on every submitSection call. The callback shape (rather than direct service
  // injection) keeps the service test seam narrow — tests pass a tiny stub.
  imports: [AdminModule],
  providers: [
    {
      provide: REPORT_SECTIONS_REPOSITORY,
      useClass: ReportSectionsPrismaRepository,
    },
    { provide: LEAD_FORM_REPOSITORY, useClass: LeadFormPrismaRepository },
    {
      provide: ReportSectionsService,
      useFactory: (repo: ReportSectionsRepository, admin: AdminService) =>
        new ReportSectionsService(repo, async () => {
          const s = await admin.getSettings();
          return {
            gracePeriodHours: s.gracePeriodHours,
            allowLateSubmissions: s.allowLateSubmissions,
          };
        }),
      inject: [REPORT_SECTIONS_REPOSITORY, AdminService],
    },
    {
      provide: LeadFormService,
      useFactory: (repo: LeadFormRepository) => new LeadFormService(repo),
      inject: [LEAD_FORM_REPOSITORY],
    },
  ],
  exports: [ReportSectionsService, LeadFormService],
})
export class ReportSectionsModule {}

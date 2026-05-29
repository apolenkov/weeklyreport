import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module";
import { AdminService } from "../admin/admin.service";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository";
import { LeadFormService } from "./lead-form.service";
import { ReportSectionsPrismaRepository } from "./report-sections.prisma-repository";
import { ReportSectionsService } from "./report-sections.service";

@Module({
  // UFB-049 / Phase 50-B: AdminModule is imported so ReportSectionsService
  // can read `gracePeriodHours` + `allowLateSubmissions` from the
  // AppSettings singleton on every submitSection call. The callback shape
  // (rather than direct service injection) keeps the service test seam
  // narrow — tests pass a tiny stub.
  imports: [AdminModule],
  providers: [
    ReportSectionsPrismaRepository,
    LeadFormPrismaRepository,
    {
      provide: ReportSectionsService,
      useFactory: (repo: ReportSectionsPrismaRepository, admin: AdminService) =>
        new ReportSectionsService(repo, async () => {
          const s = await admin.getSettings();
          return {
            gracePeriodHours: s.gracePeriodHours,
            allowLateSubmissions: s.allowLateSubmissions,
          };
        }),
      inject: [ReportSectionsPrismaRepository, AdminService],
    },
    {
      provide: LeadFormService,
      useFactory: (repo: LeadFormPrismaRepository) => new LeadFormService(repo),
      inject: [LeadFormPrismaRepository],
    },
  ],
  exports: [ReportSectionsService, LeadFormService],
})
export class ReportSectionsModule {}

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
import {
  REPORT_SECTIONS_TELEMETRY,
  type ReportSectionsTelemetry,
} from "./application/report-sections-telemetry.port.js";
import { LeadFormPrismaRepository } from "./infrastructure/lead-form.prisma-repository";
import { ReportSectionsPrismaRepository } from "./infrastructure/report-sections.prisma-repository";
import { ReportSectionsPrometheusTelemetry } from "./infrastructure/report-sections-prometheus-telemetry.adapter.js";

@Module({
  // AdminModule is imported so ReportSectionsService can read
  // `gracePeriodHours` + `allowLateSubmissions` from the AppSettings singleton
  // on every submitSection call. The callback shape (rather than direct service
  // injection) keeps the service test seam narrow — tests pass a tiny stub.
  imports: [AdminModule],
  providers: [
    ReportSectionsPrometheusTelemetry,
    {
      provide: REPORT_SECTIONS_TELEMETRY,
      useExisting: ReportSectionsPrometheusTelemetry,
    },
    {
      provide: REPORT_SECTIONS_REPOSITORY,
      useClass: ReportSectionsPrismaRepository,
    },
    { provide: LEAD_FORM_REPOSITORY, useClass: LeadFormPrismaRepository },
    {
      provide: ReportSectionsService,
      useFactory: (
        repo: ReportSectionsRepository,
        admin: AdminService,
        telemetry: ReportSectionsTelemetry,
      ) =>
        new ReportSectionsService(
          repo,
          async () => {
            const s = await admin.getSettings();
            return {
              gracePeriodHours: s.gracePeriodHours,
              allowLateSubmissions: s.allowLateSubmissions,
            };
          },
          telemetry,
        ),
      inject: [
        REPORT_SECTIONS_REPOSITORY,
        AdminService,
        REPORT_SECTIONS_TELEMETRY,
      ],
    },
    {
      provide: LeadFormService,
      useFactory: (
        repo: LeadFormRepository,
        telemetry: ReportSectionsTelemetry,
      ) => new LeadFormService(repo, telemetry),
      inject: [LEAD_FORM_REPOSITORY, REPORT_SECTIONS_TELEMETRY],
    },
  ],
  exports: [ReportSectionsService, LeadFormService],
})
export class ReportSectionsModule {}

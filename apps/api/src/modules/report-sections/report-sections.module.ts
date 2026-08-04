import { Module } from "@nestjs/common";

import { AdminModule, SnapshotAdminService } from "../admin/index.js";
import {
  LEAD_FORM_REPOSITORY,
  type LeadFormRepository,
  LeadFormService,
} from "./application/lead-form.service.js";
import {
  REPORT_SECTIONS_REPOSITORY,
  type ReportSectionsRepository,
  ReportSectionsService,
} from "./application/report-sections.service.js";
import {
  REPORT_SECTIONS_TELEMETRY,
  type ReportSectionsTelemetry,
} from "./application/report-sections-telemetry.port.js";
import { LeadFormPrismaRepository } from "./infrastructure/lead-form.prisma-repository.js";
import { ReportSectionsPrismaRepository } from "./infrastructure/report-sections.prisma-repository.js";
import { ReportSectionsPrometheusTelemetry } from "./infrastructure/report-sections-prometheus-telemetry.adapter.js";

@Module({
  // AdminModule is imported so ReportSectionsService reads gracePeriodHours +
  // allowLateSubmissions from the AppSettings singleton per submitSection. The
  // callback shape keeps the service test seam narrow.
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
        admin: SnapshotAdminService,
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
        SnapshotAdminService,
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

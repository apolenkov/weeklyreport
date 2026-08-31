import { Module } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  LEAD_FORM_REPOSITORY,
  type LeadFormRepository,
  LeadFormService,
} from "./application/lead-form.service.js";
import {
  REPORT_SECTIONS_GRACE_SETTINGS,
  type ReportSectionsGraceSettings,
} from "./application/report-sections.contract.js";
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
  providers: [
    {
      provide: REPORT_SECTIONS_GRACE_SETTINGS,
      useFactory: (
        prisma: PrismaService,
      ): (() => Promise<ReportSectionsGraceSettings>) => {
        return async () => {
          const settings = await prisma.appSettings.findUnique({
            where: { id: "singleton" },
            select: { gracePeriodHours: true, allowLateSubmissions: true },
          });
          if (!settings) {
            throw new Error(
              "AppSettings singleton row 'singleton' is missing — apply the canonical init migration or restore the row.",
            );
          }
          return settings;
        };
      },
      inject: [PrismaService],
    },
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
        getGraceSettings: () => Promise<ReportSectionsGraceSettings>,
        telemetry: ReportSectionsTelemetry,
      ) => new ReportSectionsService(repo, getGraceSettings, telemetry),
      inject: [
        REPORT_SECTIONS_REPOSITORY,
        REPORT_SECTIONS_GRACE_SETTINGS,
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

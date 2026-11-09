import { Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
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
import {
  RETAINED_SOURCE_READER,
  RetainedIncompleteRecordsService,
  type RetainedSourceReader,
} from "./application/retained-incomplete-records.service.js";
import { LeadFormPrismaRepository } from "./infrastructure/lead-form.prisma-repository.js";
import { ReportSectionsPrismaRepository } from "./infrastructure/report-sections.prisma-repository.js";
import { ReportSectionsPrometheusTelemetry } from "./infrastructure/report-sections-prometheus-telemetry.adapter.js";
import { RetainedSourcePrismaReader } from "./infrastructure/retained-incomplete-records.query.js";

@Module({
  imports: [ConfigModule],
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
        telemetry: ReportSectionsTelemetry,
        logger: AppLogger,
      ) =>
        new ReportSectionsService(
          repo,
          telemetry,
          logger.child({ service: "ReportSectionsService" }),
        ),
      inject: [
        REPORT_SECTIONS_REPOSITORY,
        REPORT_SECTIONS_TELEMETRY,
        APP_LOGGER,
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
    { provide: RETAINED_SOURCE_READER, useClass: RetainedSourcePrismaReader },
    {
      provide: RetainedIncompleteRecordsService,
      useFactory: (reader: RetainedSourceReader) =>
        new RetainedIncompleteRecordsService(reader),
      inject: [RETAINED_SOURCE_READER],
    },
  ],
  exports: [
    ReportSectionsService,
    LeadFormService,
    RetainedIncompleteRecordsService,
  ],
})
export class ReportSectionsModule {}

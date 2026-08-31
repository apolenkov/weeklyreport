import { Module } from "@nestjs/common";

import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository.js";
import { WeeklyReportService } from "./weekly-report.service.js";
import { WEEKLY_REPORT_LIFECYCLE } from "./weekly-report-lifecycle.port.js";

@Module({
  providers: [
    WeeklyReportPrismaRepository,
    {
      provide: WEEKLY_REPORT_LIFECYCLE,
      useExisting: WeeklyReportPrismaRepository,
    },
    {
      provide: WeeklyReportService,
      useFactory: (repo: WeeklyReportPrismaRepository) =>
        new WeeklyReportService(repo),
      inject: [WeeklyReportPrismaRepository],
    },
  ],
  exports: [WeeklyReportService, WEEKLY_REPORT_LIFECYCLE],
})
export class WeeklyReportModule {}

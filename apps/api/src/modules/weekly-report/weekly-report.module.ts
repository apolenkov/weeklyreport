import { Module } from "@nestjs/common";

import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository.js";
import { WeeklyReportService } from "./weekly-report.service.js";

@Module({
  providers: [
    WeeklyReportPrismaRepository,
    {
      provide: WeeklyReportService,
      useFactory: (repo: WeeklyReportPrismaRepository) =>
        new WeeklyReportService(repo),
      inject: [WeeklyReportPrismaRepository],
    },
  ],
  // WeeklyReportPrismaRepository is exported so PeriodModule's repository can
  // delegate the lifecycle resolvers (getCurrentEditableId /
  // getLatestPublishedNonArchivedId) to it instead of re-defining the queries.
  exports: [WeeklyReportService, WeeklyReportPrismaRepository],
})
export class WeeklyReportModule {}

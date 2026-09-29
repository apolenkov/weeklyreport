import { Module } from "@nestjs/common";

import { ConfigModule } from "../../infrastructure/config/config.module.js";
import { APP_LOGGER } from "../../lib/audit-logger.js";
import type { AppLogger } from "../../lib/logger.js";
import { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository.js";
import { WeeklyReportService } from "./weekly-report.service.js";
import { WEEKLY_REPORT_LIFECYCLE } from "./weekly-report-lifecycle.port.js";

@Module({
  imports: [ConfigModule],
  providers: [
    WeeklyReportPrismaRepository,
    {
      provide: WEEKLY_REPORT_LIFECYCLE,
      useExisting: WeeklyReportPrismaRepository,
    },
    {
      provide: WeeklyReportService,
      useFactory: (repo: WeeklyReportPrismaRepository, logger: AppLogger) =>
        new WeeklyReportService(
          repo,
          logger.child({ service: "WeeklyReportService" }),
        ),
      inject: [WeeklyReportPrismaRepository, APP_LOGGER],
    },
  ],
  exports: [WeeklyReportService, WEEKLY_REPORT_LIFECYCLE],
})
export class WeeklyReportModule {}

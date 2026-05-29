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
  exports: [WeeklyReportService],
})
export class WeeklyReportModule {}

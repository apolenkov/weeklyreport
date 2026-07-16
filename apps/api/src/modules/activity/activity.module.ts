import { Module } from "@nestjs/common";

import {
  WeeklyReportModule,
  WeeklyReportService,
} from "../weekly-report/index.js";
import { ActivityPrismaRepository } from "./activity.prisma-repository.js";
import { ActivityService } from "./activity.service.js";

@Module({
  imports: [WeeklyReportModule],
  providers: [
    ActivityPrismaRepository,
    {
      provide: ActivityService,
      useFactory: (
        repo: ActivityPrismaRepository,
        weeklyReportService: WeeklyReportService,
      ) =>
        new ActivityService(repo, () =>
          weeklyReportService.getCurrentLeadershipReportId(),
        ),
      inject: [ActivityPrismaRepository, WeeklyReportService],
    },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}

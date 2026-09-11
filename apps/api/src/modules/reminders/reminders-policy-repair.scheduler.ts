import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { PolicyApplicatorService } from "./policy-applicator.service.js";

const REPAIR_PAGE_SIZE = 100;

@Injectable()
export class RemindersPolicyRepairScheduler {
  private readonly logger = new Logger(RemindersPolicyRepairScheduler.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PolicyApplicatorService)
    private readonly applicator: PolicyApplicatorService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { timeZone: "UTC", waitForCompletion: true })
  async repairMissingRules(): Promise<void> {
    const sweepStart = new Date();
    const page: { cursor: string | undefined; hasMore: boolean } = {
      cursor: undefined,
      hasMore: true,
    };
    while (page.hasMore) {
      const reports = await this.prisma.report.findMany({
        where: {
          archived: false,
          periodState: { in: ["scheduled", "open"] },
          deadline: { not: null },
          createdAt: { lte: sweepStart },
          ...(page.cursor === undefined ? {} : { id: { gt: page.cursor } }),
        },
        orderBy: { id: "asc" },
        take: REPAIR_PAGE_SIZE,
        select: { id: true },
      });
      for (const report of reports) {
        await this.repairReport(report.id);
      }
      page.hasMore = reports.length === REPAIR_PAGE_SIZE;
      page.cursor = reports.at(-1)?.id;
    }
  }

  private async repairReport(reportId: string): Promise<void> {
    try {
      await this.applicator.repairToPeriod(reportId);
    } catch (error: unknown) {
      this.logger.error("Failed to repair missing reminder rules", {
        reportId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

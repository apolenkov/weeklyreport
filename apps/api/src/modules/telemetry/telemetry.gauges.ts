import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";

import {
  customreportActiveLeadsTotal,
  customreportReportsOnTimeRatio,
} from "../../infrastructure/metrics/metrics.registry.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { queryActiveLeadsLastPublishedPeriod } from "./telemetry.queries.js";

// Rolling window for the on-time-ratio gauge: last N published periods.
const ON_TIME_RATIO_WINDOW_PERIODS = 4;

// Port so unit tests inject an in-memory stub without Prisma.
export interface TelemetryGaugesPort {
  // null → no eligible data; gauge surfaces NaN.
  onTimeRatioLastNPeriods(n: number): Promise<number | null>;
  activeLeadsLastPublishedPeriod(): Promise<number>;
}

// Queries bounded to last 4 / 1 published periods so cost stays flat.
@Injectable()
export class TelemetryGaugesPrismaRepository implements TelemetryGaugesPort {
  constructor(private readonly prisma: PrismaService) {}

  async onTimeRatioLastNPeriods(n: number): Promise<number | null> {
    const reports = await this.prisma.report.findMany({
      where: { status: "published" },
      orderBy: { periodStart: "desc" },
      take: n,
      select: { id: true },
    });
    if (reports.length === 0) return null;

    const reportIds = reports.map((r) => r.id);
    const baseWhere = {
      reportId: { in: reportIds },
      status: "submitted" as const,
    };
    const [total, onTime] = await Promise.all([
      this.prisma.reportSection.count({
        where: { ...baseWhere },
      }),
      this.prisma.reportSection.count({
        where: {
          ...baseWhere,
          late: false,
        },
      }),
    ]);
    if (total === 0) return null;
    return onTime / total;
  }

  activeLeadsLastPublishedPeriod(): Promise<number> {
    // Prometheus scrapes have no requester session, so this gauge is org-wide.
    return queryActiveLeadsLastPublishedPeriod(this.prisma, {});
  }
}

// Collect callbacks run at Prom scrape (~15s); no scheduler. Destroy clears
// them so module-graph rebuilds don't pin a torn-down prisma instance.
@Injectable()
export class TelemetryGauges implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryGauges.name);

  constructor(private readonly repo: TelemetryGaugesPort) {}

  onModuleInit(): void {
    // prom-client@15: collect is runtime-assignable but TS only types it as a
    // constructor option — cast required. Capture this.repo for stable prisma.
    const onTimeRatio = customreportReportsOnTimeRatio as unknown as {
      collect: () => Promise<void>;
    };
    const activeLeads = customreportActiveLeadsTotal as unknown as {
      collect: () => Promise<void>;
    };

    onTimeRatio.collect = async () => {
      // A rejected query here would fail prom-client's Promise.all over
      // all collect callbacks, 500-ing the whole scrape during a DB
      // outage — exactly when the DB-independent metrics matter most.
      // Catch, log, and leave the gauge unset so the scrape survives.
      try {
        const value = await this.repo.onTimeRatioLastNPeriods(
          ON_TIME_RATIO_WINDOW_PERIODS,
        );
        if (value === null) {
          // Overwrite the last good sample so a has-data-to-no-data transition
          // cannot leave a stale ratio visible in subsequent scrapes.
          customreportReportsOnTimeRatio.set(Number.NaN);
          return;
        }
        customreportReportsOnTimeRatio.set(value);
      } catch (error) {
        this.logger.error(
          "customreportReportsOnTimeRatio collect failed",
          error,
        );
      }
    };
    activeLeads.collect = async () => {
      try {
        const value = await this.repo.activeLeadsLastPublishedPeriod();
        customreportActiveLeadsTotal.set(value);
      } catch (error) {
        this.logger.error("customreportActiveLeadsTotal collect failed", error);
      }
    };
  }

  onModuleDestroy(): void {
    // Reset to no-op so subsequent module reloads (rare outside tests)
    // do not invoke a torn-down prisma client.
    const onTimeRatio = customreportReportsOnTimeRatio as unknown as {
      collect: () => Promise<void>;
    };
    const activeLeads = customreportActiveLeadsTotal as unknown as {
      collect: () => Promise<void>;
    };
    onTimeRatio.collect = () => Promise.resolve();
    activeLeads.collect = () => Promise.resolve();
  }
}

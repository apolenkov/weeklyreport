import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { Gauge } from "@prometheus-io/client";

import {
  weeklyreportActiveLeadsTotal,
  weeklyreportReportsOnTimeRatio,
} from "../../infrastructure/metrics/metrics.registry.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  queryActiveLeadsLastPublishedPeriod,
  querySettledPeriodSnapshots,
} from "./telemetry.queries.js";

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async onTimeRatioLastNPeriods(n: number): Promise<number | null> {
    const snapshots = await querySettledPeriodSnapshots(this.prisma, n);
    const submitted = snapshots.flatMap((snapshot) =>
      snapshot.sections.filter((section) => section.status === "submitted"),
    );
    const total = submitted.length;
    if (total === 0) return null;
    const onTime = submitted.filter((section) => !section.late).length;
    return onTime / total;
  }

  activeLeadsLastPublishedPeriod(): Promise<number> {
    // Prometheus scrapes have no requester session, so this gauge is org-wide.
    return queryActiveLeadsLastPublishedPeriod(this.prisma);
  }
}

// The client types collect as a constructor option but accepts runtime
// assignment for scrape-time callbacks, so keep the cast localized here.
const collectAssignable = (gauge: Gauge): { collect: () => Promise<void> } =>
  gauge as unknown as { collect: () => Promise<void> };

// Collect callbacks run at Prom scrape (~15s); no scheduler. Destroy clears
// them so module-graph rebuilds don't pin a torn-down prisma instance.
@Injectable()
export class TelemetryGauges implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryGauges.name);

  constructor(
    @Inject(TelemetryGaugesPrismaRepository)
    private readonly repo: TelemetryGaugesPort,
  ) {}

  onModuleInit(): void {
    const onTimeRatio = collectAssignable(weeklyreportReportsOnTimeRatio);
    const activeLeads = collectAssignable(weeklyreportActiveLeadsTotal);

    onTimeRatio.collect = async () => {
      // A rejection here fails the client's Promise.all over all collect
      // callbacks, 500-ing the whole scrape during a DB outage — exactly
      // when the DB-independent metrics matter most.
      try {
        const value = await this.repo.onTimeRatioLastNPeriods(
          ON_TIME_RATIO_WINDOW_PERIODS,
        );
        if (value === null) {
          // Overwrite the last good sample so a has-data-to-no-data transition
          // cannot leave a stale ratio visible in subsequent scrapes.
          weeklyreportReportsOnTimeRatio.set(Number.NaN);
          return;
        }
        weeklyreportReportsOnTimeRatio.set(value);
      } catch (error) {
        // A DB outage must not publish the last good value as current: clear
        // the gauge (NaN) so the scrape reflects the unknown state.
        this.logger.error(
          "weeklyreportReportsOnTimeRatio collect failed",
          error,
        );
        weeklyreportReportsOnTimeRatio.set(Number.NaN);
      }
    };
    activeLeads.collect = async () => {
      try {
        const value = await this.repo.activeLeadsLastPublishedPeriod();
        weeklyreportActiveLeadsTotal.set(value);
      } catch (error) {
        this.logger.error("weeklyreportActiveLeadsTotal collect failed", error);
        weeklyreportActiveLeadsTotal.set(Number.NaN);
      }
    };
  }

  onModuleDestroy(): void {
    // Reset to no-op so subsequent module reloads (rare outside tests)
    // do not invoke a torn-down prisma client.
    const onTimeRatio = collectAssignable(weeklyreportReportsOnTimeRatio);
    const activeLeads = collectAssignable(weeklyreportActiveLeadsTotal);
    onTimeRatio.collect = () => Promise.resolve();
    activeLeads.collect = () => Promise.resolve();
  }
}

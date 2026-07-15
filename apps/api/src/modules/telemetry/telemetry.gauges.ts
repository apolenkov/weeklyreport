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

/** Rolling window for the on-time-ratio gauge: last N published periods. */
const ON_TIME_RATIO_WINDOW_PERIODS = 4;

/**
 * Port shape used by the gauges service. Declared as an interface so unit
 * tests can inject an in-memory stub without standing up the Prisma client —
 * the production wiring (TelemetryModule) constructs the service with the
 * Prisma-backed implementation below.
 */
export interface TelemetryGaugesPort {
  /**
   * Return the fraction of `submitted` sections that were on-time
   * (`late=false`) across the last `n` published periods. Returns `null`
   * when there is no eligible data (no published periods or no submitted
   * sections) — caller decides how to surface the missing value to
   * Prometheus (the gauge reports NaN).
   */
  onTimeRatioLastNPeriods(n: number): Promise<number | null>;
  /**
   * Distinct lead author count for the single most-recently-published
   * period. Returns 0 when there is no published period yet.
   */
  activeLeadsLastPublishedPeriod(): Promise<number>;
}

/**
 * Prisma-backed implementation. Both queries are constrained to the last
 * 4 / 1 published periods respectively so the cost stays bounded
 * regardless of history depth.
 */
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
    const [total, onTime] = await Promise.all([
      this.prisma.reportSection.count({
        where: { reportId: { in: reportIds }, status: "submitted" },
      }),
      this.prisma.reportSection.count({
        where: {
          reportId: { in: reportIds },
          status: "submitted",
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

/**
 * Wires the two query-backed gauges to the prom-client
 * registry via Gauge.collect async callbacks. The callbacks run at Prom
 * scrape time (every ~15s in production), so the queries above are
 * effectively rate-limited to scrape cadence — no scheduler needed.
 *
 * `onModuleInit` installs the callbacks; `onModuleDestroy` removes them
 * so unit tests that rebuild the module graph don't accumulate stale
 * closures pinning a teardown prisma instance.
 */
@Injectable()
export class TelemetryGauges implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryGauges.name);

  constructor(private readonly repo: TelemetryGaugesPort) {}

  onModuleInit(): void {
    // prom-client@15 supports `.collect` as a runtime-assignable callback
    // (invoked on registry scrape — see prom-client/lib/gauge.js:109).
    // The TypeScript surface declares `collect` only as a constructor
    // option, hence the typed-assignment cast. Capturing `this.repo`
    // gives the closure a stable prisma reference even if the module is
    // rebound under hot reload.
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

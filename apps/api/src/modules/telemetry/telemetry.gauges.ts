import {
  Injectable,
  type OnModuleInit,
  type OnModuleDestroy,
} from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  customreportActiveLeadsTotal,
  customreportReportsOnTimeRatio,
} from "../../infrastructure/metrics/metrics.registry.js";

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
   * Prometheus (Gauge stays unset, scrape emits NaN).
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

  async activeLeadsLastPublishedPeriod(): Promise<number> {
    const report = await this.prisma.report.findFirst({
      where: { status: "published" },
      orderBy: { periodStart: "desc" },
      select: { id: true },
    });
    if (!report) return 0;
    const distinct = await this.prisma.reportSection.findMany({
      where: { reportId: report.id, status: "submitted" },
      distinct: ["authorId"],
      select: { authorId: true },
    });
    return distinct.length;
  }
}

/**
 * 52-A (UFB-054): wires the two query-backed gauges to the prom-client
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
      const value = await this.repo.onTimeRatioLastNPeriods(4);
      if (value !== null) {
        customreportReportsOnTimeRatio.set(value);
      }
      // If null → leave gauge unset; prom-client emits the last-set
      // value or NaN, which the dashboard panel renders as "no data"
      // rather than a misleading 0.
    };
    activeLeads.collect = async () => {
      const value = await this.repo.activeLeadsLastPublishedPeriod();
      customreportActiveLeadsTotal.set(value);
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
    onTimeRatio.collect = async () => undefined;
    activeLeads.collect = async () => undefined;
  }
}

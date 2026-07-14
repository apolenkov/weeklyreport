import type { TelemetrySummary, UserSession } from "@customreport/shared";
import { telemetrySummarySchema } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { scopeDiscriminator } from "../../lib/group-scope.js";

/** Number of trailing periods shown on the KPI card's sparkline. */
const SPARKLINE_PERIOD_COUNT = 4;

/**
 * Port shape consumed by TelemetryService — Prisma-agnostic so unit
 * tests can stub the four read methods without a database. The
 * production wiring (TelemetryModule) constructs the service with the
 * Prisma-backed repository.
 */
export interface TelemetryRepository {
  /** Count of Report rows in the most recently created period (any status). */
  reportsThisPeriodCount(session: UserSession): Promise<number>;
  /** Distinct lead authors who submitted in the most recent published period. */
  activeLeadsLastPublishedPeriod(session: UserSession): Promise<number>;
  /** Sections with `late=true AND status='submitted'` in the last published period. */
  lateSectionsLastPublishedPeriod(session: UserSession): Promise<number>;
  /** Reopen requests still in `pending` state across all periods. */
  pendingReopenCount(session: UserSession): Promise<number>;
  /** PDF export rows created in the last 7 days. */
  pdfExportsLast7d(session: UserSession): Promise<number>;
  /**
   * On-time ratio (`late=false / total submitted`) per published period,
   * oldest → newest, up to `n` entries. Periods without submitted
   * sections are filtered out by the caller.
   */
  onTimeRatioPerPeriod(n: number, session: UserSession): Promise<number[]>;
}

/**
 * 60-second read-through Redis cache port. The production implementation
 * lives in telemetry.cache.ts; tests pass a pass-through stub.
 */
export interface TelemetryCachePort {
  getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

/**
 * Pass-through cache used as the default when Redis is unavailable —
 * delegates straight to the compute function. Lets the service work in
 * test scenarios and degraded prod without a separate code path.
 */
export class NullTelemetryCache implements TelemetryCachePort {
  async getOrCompute<T>(_key: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
}

@Injectable()
export class TelemetryService {
  constructor(
    private readonly repository: TelemetryRepository,
    private readonly cache: TelemetryCachePort = new NullTelemetryCache(),
  ) {}

  /**
   * Returns the leadership-readable KPI bundle for the `/dashboard`
   * card. Cached for 60 seconds within the caller's group-scope partition so
   * a hot dashboard refresh does not stampede the database or reuse another
   * group's aggregate. The key embeds a version suffix so schema additions
   * can invalidate cleanly via a bump.
   */
  async getSummary(session: UserSession): Promise<TelemetrySummary> {
    const cacheKey = `summary:v1:${scopeDiscriminator(session)}`;
    return this.cache.getOrCompute<TelemetrySummary>(cacheKey, async () => {
      const sparkline = await this.repository.onTimeRatioPerPeriod(
        SPARKLINE_PERIOD_COUNT,
        session,
      );
      // Headline ratio = the freshest single period only (the last sparkline
      // entry). This is a DIFFERENT window from the Prometheus
      // `onTimeRatioLastNPeriods` gauge, which pools across the last N periods;
      // the two are intentionally not collapsed.
      const latestPeriodOnTimeRatio =
        sparkline.length === 0
          ? null
          : (sparkline[sparkline.length - 1] ?? null);

      const [
        reportsThisPeriod,
        activeLeads,
        lateSections,
        pendingReopens,
        pdfExportsLast7d,
      ] = await Promise.all([
        this.repository.reportsThisPeriodCount(session),
        this.repository.activeLeadsLastPublishedPeriod(session),
        this.repository.lateSectionsLastPublishedPeriod(session),
        this.repository.pendingReopenCount(session),
        this.repository.pdfExportsLast7d(session),
      ]);

      return telemetrySummarySchema.parse({
        reportsThisPeriod,
        onTimeRatio: latestPeriodOnTimeRatio,
        activeLeads,
        lateSections,
        pendingReopens,
        pdfExportsLast7d,
        sparkline,
      });
    });
  }
}

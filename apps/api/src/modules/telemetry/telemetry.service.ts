import type { TelemetrySummary } from "@customreport/shared";
import { telemetrySummarySchema } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

/**
 * Port shape consumed by TelemetryService — Prisma-agnostic so unit
 * tests can stub the four read methods without a database. The
 * production wiring (TelemetryModule) constructs the service with the
 * Prisma-backed repository.
 */
export interface TelemetryRepository {
  /** Count of Report rows in the most recently created period (any status). */
  reportsThisPeriodCount(): Promise<number>;
  /** Distinct lead authors who submitted in the most recent published period. */
  activeLeadsLastPublishedPeriod(): Promise<number>;
  /** Sections with `late=true AND status='submitted'` in the last published period. */
  lateSectionsLastPublishedPeriod(): Promise<number>;
  /** Reopen requests still in `pending` state across all periods. */
  pendingReopenCount(): Promise<number>;
  /** PDF export rows created in the last 7 days. */
  pdfExportsLast7d(): Promise<number>;
  /**
   * On-time ratio (`late=false / total submitted`) per published period,
   * oldest → newest, up to `n` entries. Periods without submitted
   * sections are filtered out by the caller.
   */
  onTimeRatioPerPeriod(n: number): Promise<number[]>;
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
   * card. Cached for 60 seconds (key `summary:v1`) so a hot dashboard
   * refresh from multiple viewers does not stampede the database. The
   * cache key embeds a version suffix so schema additions can invalidate
   * cleanly via a bump.
   */
  async getSummary(): Promise<TelemetrySummary> {
    return this.cache.getOrCompute<TelemetrySummary>("summary:v1", async () => {
      const sparkline = await this.repository.onTimeRatioPerPeriod(4);
      const onTimeRatio =
        sparkline.length === 0
          ? null
          : // The freshest entry is the headline on-time ratio.
            (sparkline[sparkline.length - 1] ?? null);

      const [
        reportsThisPeriod,
        activeLeads,
        lateSections,
        pendingReopens,
        pdfExportsLast7d,
      ] = await Promise.all([
        this.repository.reportsThisPeriodCount(),
        this.repository.activeLeadsLastPublishedPeriod(),
        this.repository.lateSectionsLastPublishedPeriod(),
        this.repository.pendingReopenCount(),
        this.repository.pdfExportsLast7d(),
      ]);

      return telemetrySummarySchema.parse({
        reportsThisPeriod,
        onTimeRatio,
        activeLeads,
        lateSections,
        pendingReopens,
        pdfExportsLast7d,
        sparkline,
      });
    });
  }
}

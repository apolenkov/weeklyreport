import type { TelemetrySummary, UserSession } from "@customreport/shared";
import { telemetrySummarySchema } from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { scopeDiscriminator } from "../../lib/group-scope.js";

// Trailing periods on the KPI sparkline.
const SPARKLINE_PERIOD_COUNT = 4;

// Prisma-agnostic port so unit tests stub without a database.
export interface TelemetryRepository {
  reportsThisPeriodCount(session: UserSession): Promise<number>;
  activeLeadsLastPublishedPeriod(session: UserSession): Promise<number>;
  lateSectionsLastPublishedPeriod(session: UserSession): Promise<number>;
  pendingReopenCount(session: UserSession): Promise<number>;
  pdfExportsLast7d(session: UserSession): Promise<number>;
  onTimeRatioPerPeriod(n: number, session: UserSession): Promise<number[]>;
}

export interface TelemetryCachePort {
  getOrCompute<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

// Pass-through when Redis is unavailable (tests / degraded prod).
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

  // Cached 60s per group-scope partition; key version suffix for clean invalidation.
  async getSummary(session: UserSession): Promise<TelemetrySummary> {
    const cacheKey = `summary:v1:${scopeDiscriminator(session)}`;
    return this.cache.getOrCompute<TelemetrySummary>(cacheKey, async () => {
      const sparkline = await this.repository.onTimeRatioPerPeriod(
        SPARKLINE_PERIOD_COUNT,
        session,
      );
      // Headline = freshest period only; Prometheus gauge pools last N — not collapsed.
      const latestPeriodOnTimeRatio = sparkline.at(-1) ?? null;

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

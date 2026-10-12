import type { TelemetrySummary, UserSession } from "@customreport/shared";
import { telemetrySummarySchema } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { scopeDiscriminator } from "../../lib/group-scope.js";
import { TelemetryCache } from "./telemetry.cache.js";
import type {
  TelemetryCachePort,
  TelemetryRepository,
} from "./telemetry.ports.js";
import { TelemetryPrismaRepository } from "./telemetry.prisma-repository.js";

export type {
  TelemetryCachePort,
  TelemetryRepository,
} from "./telemetry.ports.js";

// Trailing periods on the KPI sparkline.
const SPARKLINE_PERIOD_COUNT = 4;

@Injectable()
export class TelemetryService {
  constructor(
    @Inject(TelemetryPrismaRepository)
    private readonly repository: TelemetryRepository,
    @Inject(TelemetryCache)
    private readonly cache: TelemetryCachePort,
  ) {}

  // Cached 60s per group-scope partition; key version suffix for clean invalidation.
  async getSummary(session: UserSession): Promise<TelemetrySummary> {
    const cacheKey = `summary:v2:${scopeDiscriminator(session)}`;
    return this.cache.getOrCompute<TelemetrySummary>(
      cacheKey,
      async () => {
        const window = await this.repository.onTimeRatioPerPeriod(
          SPARKLINE_PERIOD_COUNT,
          session,
        );
        // Compact history may omit the latest period; it cannot supply the headline.

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
          onTimeRatio: window.latestPeriodRatio,
          activeLeads,
          lateSections,
          pendingReopens,
          pdfExportsLast7d,
          sparkline: window.ratios,
        });
      },
      (value): value is TelemetrySummary =>
        telemetrySummarySchema.safeParse(value).success,
    );
  }
}

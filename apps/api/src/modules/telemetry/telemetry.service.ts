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

// Pass-through when Redis is unavailable (tests / degraded prod).
export class NullTelemetryCache implements TelemetryCachePort {
  readonly getOrCompute = async <T>(
    _key: string,
    fn: () => Promise<T>,
    _validate?: (value: unknown) => value is T,
  ): Promise<T> => {
    return fn();
  };
}

@Injectable()
export class TelemetryService {
  constructor(
    @Inject(TelemetryPrismaRepository)
    private readonly repository: TelemetryRepository,
    @Inject(TelemetryCache)
    private readonly cache: TelemetryCachePort = new NullTelemetryCache(),
  ) {}

  // Cached 60s per group-scope partition; key version suffix for clean invalidation.
  async getSummary(session: UserSession): Promise<TelemetrySummary> {
    const cacheKey = `summary:v1:${scopeDiscriminator(session)}`;
    return this.cache.getOrCompute<TelemetrySummary>(
      cacheKey,
      async () => {
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
      },
      (value): value is TelemetrySummary =>
        telemetrySummarySchema.safeParse(value).success,
    );
  }
}

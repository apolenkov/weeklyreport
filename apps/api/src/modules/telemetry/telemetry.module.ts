import { Module } from "@nestjs/common";

import {
  TelemetryGauges,
  TelemetryGaugesPrismaRepository,
} from "./telemetry.gauges.js";
import { TelemetryService } from "./telemetry.service.js";
import { TelemetryPrismaRepository } from "./telemetry.prisma-repository.js";
import { TelemetryCache } from "./telemetry.cache.js";

/**
 * Phase 52 (UFB-054) — product-telemetry wiring.
 *
 *  - `TelemetryGauges` installs Prom `collect` callbacks on boot.
 *  - `TelemetryService` backs the `telemetry.summary` tRPC procedure
 *    consumed by the in-app KPI card. Cached for 60s via Redis to keep
 *    the dashboard refresh cheap.
 */
@Module({
  providers: [
    TelemetryGaugesPrismaRepository,
    {
      provide: TelemetryGauges,
      useFactory: (repo: TelemetryGaugesPrismaRepository) =>
        new TelemetryGauges(repo),
      inject: [TelemetryGaugesPrismaRepository],
    },
    TelemetryPrismaRepository,
    TelemetryCache,
    {
      provide: TelemetryService,
      useFactory: (repo: TelemetryPrismaRepository, cache: TelemetryCache) =>
        new TelemetryService(repo, cache),
      inject: [TelemetryPrismaRepository, TelemetryCache],
    },
  ],
  exports: [TelemetryGauges, TelemetryGaugesPrismaRepository, TelemetryService],
})
export class TelemetryModule {}

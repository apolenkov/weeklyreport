import { Module } from "@nestjs/common";

import {
  ConfigModule,
  ENV_CONFIG,
} from "../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { TelemetryCache } from "./telemetry.cache.js";
import {
  TelemetryGauges,
  TelemetryGaugesPrismaRepository,
} from "./telemetry.gauges.js";
import { TelemetryPrismaRepository } from "./telemetry.prisma-repository.js";
import { TelemetryService } from "./telemetry.service.js";

/**
 * Product-telemetry wiring.
 *
 *  - `TelemetryGauges` installs Prom `collect` callbacks on boot.
 *  - `TelemetryService` backs the `telemetry.summary` tRPC procedure
 *    consumed by the in-app KPI card. Cached for 60s via Redis to keep
 *    the dashboard refresh cheap.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    TelemetryGaugesPrismaRepository,
    {
      provide: TelemetryGauges,
      useFactory: (repo: TelemetryGaugesPrismaRepository) =>
        new TelemetryGauges(repo),
      inject: [TelemetryGaugesPrismaRepository],
    },
    TelemetryPrismaRepository,
    {
      provide: TelemetryCache,
      useFactory: (env: EnvConfig) => new TelemetryCache(env),
      inject: [ENV_CONFIG],
    },
    {
      provide: TelemetryService,
      useFactory: (repo: TelemetryPrismaRepository, cache: TelemetryCache) =>
        new TelemetryService(repo, cache),
      inject: [TelemetryPrismaRepository, TelemetryCache],
    },
  ],
  exports: [TelemetryGauges, TelemetryService],
})
export class TelemetryModule {}

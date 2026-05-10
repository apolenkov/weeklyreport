import { Module } from '@nestjs/common';

import {
  TelemetryGauges,
  TelemetryGaugesPrismaRepository,
} from './telemetry.gauges.js';

/**
 * Phase 52 (UFB-054) — product-telemetry wiring.
 *
 * For this milestone the module only exposes the gauges service that
 * installs `prom-client` `collect` callbacks at boot. Future commits
 * will register TelemetryService + the `telemetry.summary` tRPC plumbing
 * under the same module so the boundary stays narrow.
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
  ],
  exports: [TelemetryGauges, TelemetryGaugesPrismaRepository],
})
export class TelemetryModule {}

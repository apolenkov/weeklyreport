import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it } from "vitest";

import { APP_LOGGER } from "../../lib/audit-logger.js";
import { SnapshotAdminService } from "../admin/index.js";
import { AnalyticsCache } from "../analytics/index.js";
import {
  PERIOD_REPOSITORY,
  PeriodService,
} from "./application/period.service.js";
import { PERIOD_TELEMETRY } from "./application/period-telemetry.port.js";
import { PeriodModule } from "./period.module.js";

interface FactoryProvider {
  readonly provide: unknown;
  readonly inject: readonly unknown[];
}

function isPeriodServiceFactory(entry: unknown): entry is FactoryProvider {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "provide" in entry &&
    entry.provide === PeriodService &&
    "useFactory" in entry &&
    typeof entry.useFactory === "function" &&
    "inject" in entry &&
    Array.isArray(entry.inject)
  );
}

describe("PeriodModule wiring", () => {
  it("resolves PeriodService with product-owned dependencies only", () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      PeriodModule,
    ) as unknown[];
    const provider = providers.find(isPeriodServiceFactory);

    expect(provider).toBeDefined();
    expect(provider?.inject).toEqual([
      PERIOD_REPOSITORY,
      AnalyticsCache,
      SnapshotAdminService,
      PERIOD_TELEMETRY,
      APP_LOGGER,
    ]);
  });
});

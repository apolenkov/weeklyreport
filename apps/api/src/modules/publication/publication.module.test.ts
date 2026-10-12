import { MODULE_METADATA } from "@nestjs/common/constants.js";
import type { AssembledReport } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { APP_LOGGER } from "../../lib/audit-logger.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { AnalyticsCache } from "../analytics/index.js";
import {
  PUBLICATION_REPOSITORY,
  type PublicationRepository,
  PublicationService,
} from "./application/publication.service.js";
import {
  NOOP_PUBLICATION_TELEMETRY,
  PUBLICATION_TELEMETRY,
  type PublicationTelemetry,
} from "./application/publication-telemetry.port.js";
import { PublicationModule } from "./publication.module.js";

const reportId = "22222222-2222-4222-8222-222222222222";

interface FactoryProvider {
  provide: unknown;
  useFactory: (
    repo: PublicationRepository,
    analyticsCache: Pick<AnalyticsCache, "invalidateAll">,
    telemetry: PublicationTelemetry,
    logger: AppLogger,
  ) => PublicationService;
  inject: unknown[];
}

function isFactoryProvider(entry: unknown): entry is FactoryProvider {
  if (typeof entry !== "object" || entry === null) {
    return false;
  }
  if (
    !("provide" in entry) ||
    !("useFactory" in entry) ||
    !("inject" in entry)
  ) {
    return false;
  }
  return (
    entry.provide === PublicationService &&
    typeof entry.useFactory === "function"
  );
}

// Read provider metadata directly so the test pins the exact factory and
// injection order without booting unrelated PublicationModule dependencies.
function resolvePublicationServiceFactory(): FactoryProvider {
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    PublicationModule,
  ) as unknown[];
  const provider = providers.find(isFactoryProvider);
  if (!provider) {
    throw new Error(
      "PublicationModule is missing a useFactory provider for PublicationService",
    );
  }
  return provider;
}

const draftReport: AssembledReport = {
  reportId,
  periodStart: new Date("2026-04-06T00:00:00.000Z"),
  periodEnd: new Date("2026-04-12T23:59:59.000Z"),
  deadline: new Date("2026-04-10T15:00:00.000Z"),
  status: "draft",
  publishedAt: null,
  publishedById: null,
  publishedByName: null,
  portfolioOverview: {
    status: "green",
    totals: { green: 0, yellow: 0, red: 0 },
  },
  sections: [],
};

describe("PublicationModule wiring", () => {
  it("wires invalidateAnalyticsCache to AnalyticsCache.invalidateAll", async () => {
    const provider = resolvePublicationServiceFactory();
    expect(provider.inject).toEqual([
      PUBLICATION_REPOSITORY,
      AnalyticsCache,
      PUBLICATION_TELEMETRY,
      APP_LOGGER,
    ]);

    const invalidateAll = vi.fn(() => Promise.resolve());
    const mockCache = { invalidateAll };
    const repository: PublicationRepository = {
      getAssembledReport: () => Promise.resolve(structuredClone(draftReport)),
      saveAutoPublishedReport: (nextReport) =>
        Promise.resolve({
          published: true as const,
          wasAlreadyPublished: false,
          report: structuredClone(nextReport),
        }),
    };

    const service = provider.useFactory(
      repository,
      mockCache,
      NOOP_PUBLICATION_TELEMETRY,
      createNullLogger(),
    );

    await service.publishAuto(reportId, new Date("2026-04-10T18:00:00.000Z"));

    expect(invalidateAll).toHaveBeenCalledTimes(1);
  });
});

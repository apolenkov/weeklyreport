import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { AnalyticsPrismaRepository } from "../../analytics/analytics.prisma-repository.js";
import type { AnalyticsCachePort } from "../../analytics/analytics.service.js";
import { AnalyticsService } from "../../analytics/index.js";
import {
  NoopIngestionQueue,
  PublicationService,
} from "../application/publication.service.js";
import { PublicationPrismaRepository } from "./publication.prisma-repository.js";

interface InvalidatableCache extends AnalyticsCachePort {
  invalidateAll(): Promise<void>;
}

function createCache(): InvalidatableCache {
  const values = new Map<string, unknown>();
  return {
    async getOrCompute<T>(key: string, compute: () => Promise<T>): Promise<T> {
      if (values.has(key)) return values.get(key) as T;
      const value = await compute();
      values.set(key, value);
      return value;
    },
    invalidateAll(): Promise<void> {
      values.clear();
      return Promise.resolve();
    },
  };
}

describe("PublicationService analytics invalidation (integration)", () => {
  const prisma = createTestPrisma();

  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("recomputes a warmed analytics query after publishAuto", async () => {
    const data = await seedTestData(prisma);
    await prisma.projectStatus.create({
      data: {
        reportSectionId: data.section.id,
        projectId: data.project.id,
        status: "green",
      },
    });
    const cache = createCache();
    const analyticsRepository = new AnalyticsPrismaRepository(prisma as never);
    const compute = vi.spyOn(analyticsRepository, "trafficLightHistory");
    const analytics = new AnalyticsService(analyticsRepository, cache);
    const publication = new PublicationService(
      new PublicationPrismaRepository(prisma as never),
      undefined,
      new NoopIngestionQueue(),
      () => cache.invalidateAll(),
    );
    const session: UserSession = {
      userId: data.head.id,
      email: data.head.email,
      name: data.head.name,
      role: "admin",
      activeReportId: data.report.id,
      activeReportSectionId: null,
      reportingGroupId: expectDefined(data.head.reportingGroupId),
    };
    const input = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };

    const beforePublish = await analytics.trafficLightHistory(input, session);
    await analytics.trafficLightHistory(input, session);
    await publication.publishAuto(data.report.id);
    const afterPublish = await analytics.trafficLightHistory(input, session);

    expect(beforePublish).toEqual({ periods: [], rows: [] });
    expect(compute).toHaveBeenCalledTimes(2);
    expect(afterPublish.periods).toEqual(["2026-04-13"]);
    expect(afterPublish.rows).toEqual([
      {
        projectId: data.project.id,
        projectName: data.project.name,
        statuses: ["green"],
      },
    ]);
  });
});

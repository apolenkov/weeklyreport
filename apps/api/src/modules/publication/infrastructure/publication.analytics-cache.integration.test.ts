import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { AnalyticsService } from "../../analytics/index.js";
import {
  type AnalyticsCachePort,
  AnalyticsPrismaRepository,
} from "../../analytics/test-seams/index.js";
import { PublicationService } from "../application/publication.service.js";
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
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("recomputes a warmed analytics query after publishAuto", async () => {
    const data = await seedTestData(prisma);
    const stage = await prisma.stage.create({
      data: {
        id: "a0000000-0000-4000-a000-000000000a91",
        name: "Development",
        sortOrder: 1,
      },
    });
    await prisma.stageAssignment.create({
      data: {
        userId: data.lead.id,
        projectId: data.project.id,
        stageId: stage.id,
      },
    });
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
      createNullLogger(),
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
    await publication.publishAuto(
      data.report.id,
      new Date("2026-04-13T12:00:00.000Z"),
    );
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

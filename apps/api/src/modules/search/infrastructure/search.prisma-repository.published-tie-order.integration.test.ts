import type { Prisma } from "@prisma/client";
import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../../lib/logger.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
} from "../../../test-utils/prisma-test-helper";
import { SearchService } from "../application/search.service";
import { replacePublishedProjections } from "../published-search-projection";
import { SearchPrismaRepository } from "./search.prisma-repository";

// Equal rank + equal createdAt is the norm inside one published report: every
// projected document carries the report's publishedAt. This pins which records
// survive the SQL LIMIT when such a tie straddles it.
describe("SearchService over published documents — tie at the LIMIT boundary (integration)", () => {
  const prisma = createTestPrisma();
  let service: SearchService;

  const GROUP_ID = "b0000000-0000-4000-a000-0000000000a1";
  const PROJECT_ID = "b0000000-0000-4000-a000-0000000000d1";
  const LEAD_ID = "b0000000-0000-4000-a000-0000000000c1";
  const REPORT_ID = "b0000000-0000-4000-a000-0000000000e1";
  const SECTION_ID = "b0000000-0000-4000-a000-0000000000f1";
  const Q = "tieordertoken";
  // Ascending ids: the service order (id ASC) puts ITEMS[0] first.
  const ITEMS = [
    "b0000000-0000-4000-a000-000000000101",
    "b0000000-0000-4000-a000-000000000102",
    "b0000000-0000-4000-a000-000000000103",
  ] as const;

  const head: UserSession = {
    userId: LEAD_ID,
    email: "head@test.local",
    name: "Head",
    role: "head",
    reportingGroupId: GROUP_ID,
    viewerGroupAccess: [],
  };

  function snapshot(periodDate: Date): Prisma.InputJsonObject {
    return {
      ...(publishedSnapshotFixture({
        reportId: REPORT_ID,
        periodStart: periodDate,
        periodEnd: periodDate,
        deadline: periodDate,
        publishedAt: periodDate,
      }) as Prisma.InputJsonObject),
      sections: [
        {
          reportId: REPORT_ID,
          reportSectionId: SECTION_ID,
          authorId: LEAD_ID,
          authorName: "Lead",
          authorRole: "lead",
          groupId: GROUP_ID,
          groupName: "Group",
          version: 1,
          status: "submitted",
          submittedAt: periodDate.toISOString(),
          late: false,
          projects: [
            {
              projectId: PROJECT_ID,
              projectName: "Tie Platform",
              trafficLight: "green",
              ownedStages: [],
              stageSet: [],
              ownerGroupId: GROUP_ID,
            },
          ],
          referencedProjects: [],
          activities: [],
          reviews: [],
          risks: [],
          decisions: [],
          items: ITEMS.map((id) => ({
            id,
            stableId: `${id.slice(0, -4)}f${id.slice(-3)}`,
            projectId: PROJECT_ID,
            activityId: null,
            type: "current",
            text: `${Q} same text`,
            tag: "general",
            workflowStatus: "in_progress",
            carriedOver: false,
            priorityRank: null,
            pausedReason: null,
            stageNames: ["Development"],
          })),
        },
      ],
    };
  }

  beforeAll(() => {
    service = new SearchService(
      new SearchPrismaRepository(prisma as unknown as PrismaService),
      createNullLogger(),
    );
  });

  beforeEach(async () => {
    await cleanDatabase();
    const periodDate = new Date("2026-05-04T00:00:00.000Z");
    const published = snapshot(periodDate);
    await prisma.report.create({
      data: {
        id: REPORT_ID,
        periodStart: periodDate,
        periodEnd: periodDate,
        deadline: periodDate,
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: periodDate,
        publishedSnapshot: published,
      },
    });
    await prisma.$transaction(async (tx) => {
      await replacePublishedProjections(tx, {
        reportId: REPORT_ID,
        snapshot: published,
      });
    });
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  const query = (limit: number) =>
    service.query({ q: Q, scope: "published", limit }, head);

  // Control: with room for all three the service order is id ASC.
  it("returns all tied records in id ascending order when the limit covers them", async () => {
    expect((await query(3)).map((hit) => hit.id)).toEqual([...ITEMS]);
  });

  // C1805: a pre-LIMIT order that disagrees with the service order would keep
  // ITEMS[1] and ITEMS[2] here and lose the first record in service order.
  it("keeps the first records in service order when the tie straddles the limit", async () => {
    expect((await query(2)).map((hit) => hit.id)).toEqual([ITEMS[0], ITEMS[1]]);
  });
});

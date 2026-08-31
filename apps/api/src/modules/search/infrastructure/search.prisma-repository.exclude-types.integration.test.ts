import type { SearchHit } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper";
import { SearchPrismaRepository } from "./search.prisma-repository";

const GROUP_ID = "c0000000-0000-4000-a000-000000000001";
const LEAD_ID = "c0000000-0000-4000-a000-000000000002";
const PROJECT_ID = "c0000000-0000-4000-a000-000000000003";
const REPORT_ID = "c0000000-0000-4000-a000-000000000004";
const SECTION_ID = "c0000000-0000-4000-a000-000000000005";
const ITEM_ID = "c0000000-0000-4000-a000-000000000006";
const RISK_ID = "c0000000-0000-4000-a000-000000000007";
const DECISION_ID = "c0000000-0000-4000-a000-000000000008";
const QUERY = "exclusionprecisiontoken";
const HIT_TYPES = ["item", "risk", "decision", "project"] as const;

describe("SearchPrismaRepository excludeTypes (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new SearchPrismaRepository(prisma as never);

  beforeEach(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.create({
      data: { id: GROUP_ID, name: "Search Precision Group" },
    });
    await prisma.user.create({
      data: {
        id: LEAD_ID,
        email: "search-precision@test.local",
        name: "Search Precision Lead",
        lastName: "Precision",
        firstName: "Search",
        role: "lead",
        samlId: "search-precision-lead",
        reportingGroupId: GROUP_ID,
      },
    });
    await prisma.project.create({
      data: {
        id: PROJECT_ID,
        name: `${QUERY} platform`,
        leadId: LEAD_ID,
      },
    });
    await prisma.groupProduct.create({
      data: { groupId: GROUP_ID, productId: PROJECT_ID },
    });
    await prisma.report.create({
      data: {
        id: REPORT_ID,
        periodStart: new Date("2036-01-07T00:00:00.000Z"),
        periodEnd: new Date("2036-01-13T23:59:59.999Z"),
        deadline: new Date("2036-01-11T15:00:00.000Z"),
        status: "draft",
        periodStatus: "open",
      },
    });
    await prisma.reportSection.create({
      data: {
        id: SECTION_ID,
        reportId: REPORT_ID,
        authorId: LEAD_ID,
        status: "submitted",
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: SECTION_ID,
        projectId: PROJECT_ID,
        status: "green",
      },
    });
    await prisma.item.create({
      data: {
        id: ITEM_ID,
        reportSectionId: SECTION_ID,
        projectId: PROJECT_ID,
        type: "current",
        text: `${QUERY} item`,
        tag: "general",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    });
    await prisma.risk.create({
      data: {
        id: RISK_ID,
        reportSectionId: SECTION_ID,
        projectId: PROJECT_ID,
        risk: `${QUERY} risk`,
        impact: "high",
        mitigation: "mitigate",
        severity: "at-risk",
        stageNames: ["Development"],
      },
    });
    await prisma.decision.create({
      data: {
        id: DECISION_ID,
        reportSectionId: SECTION_ID,
        productId: PROJECT_ID,
        text: `${QUERY} decision`,
        owner: "owner",
        impact: "high",
        stageNames: ["Development"],
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it.each(HIT_TYPES)(
    "omits %s while every other hit type still appears",
    async (excludedType) => {
      const hits = await repository.search({
        q: QUERY,
        scope: "all",
        userId: LEAD_ID,
        groupIds: null,
        excludeTypes: [excludedType],
        limit: 10,
      });
      const actualTypes = hits.map(({ type }) => type);
      const expectedTypes: SearchHit["type"][] = HIT_TYPES.filter(
        (type) => type !== excludedType,
      );

      expect(actualTypes).not.toContain(excludedType);
      expect(actualTypes).toHaveLength(expectedTypes.length);
      expect(actualTypes).toEqual(expect.arrayContaining(expectedTypes));
    },
  );
});

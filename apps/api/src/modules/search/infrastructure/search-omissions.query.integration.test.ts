// What a search corpus leaves out (openspec: search-contract-precision,
// viewer-published-search): unfinished risks and decisions are counted over
// the same authorized corpus as the query, before any text is matched.
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
} from "../../../test-utils/prisma-test-helper";
import { SearchPrismaRepository } from "./search.prisma-repository";

const GROUP_A = "d0000000-0000-4000-a000-000000000001";
const GROUP_B = "d0000000-0000-4000-a000-000000000002";
const LEAD_A = "d0000000-0000-4000-a000-000000000003";
const LEAD_B = "d0000000-0000-4000-a000-000000000004";
const PROJECT_ID = "d0000000-0000-4000-a000-000000000005";
const OPEN_REPORT = "d0000000-0000-4000-a000-000000000006";
const PUBLISHED_REPORT = "d0000000-0000-4000-a000-000000000007";
const LEGACY_REPORT = "d0000000-0000-4000-a000-000000000008";
const SECTION_A = "d0000000-0000-4000-a000-000000000009";
const SECTION_B = "d0000000-0000-4000-a000-00000000000a";
const FROZEN_A = "d0000000-0000-4000-a000-00000000000b";
const FROZEN_B = "d0000000-0000-4000-a000-00000000000c";
const LEGACY_A = "d0000000-0000-4000-a000-00000000000d";

describe("search corpus omissions (integration)", () => {
  const prisma = createTestPrisma();
  const repository = new SearchPrismaRepository(prisma as never);

  async function createLead(id: string, groupId: string): Promise<void> {
    await prisma.user.create({
      data: {
        id,
        email: `${id}@test.local`,
        name: `Lead ${id.slice(-1)}`,
        lastName: "Lead",
        firstName: id.slice(-1),
        role: "lead",
        samlId: id,
        reportingGroupId: groupId,
      },
    });
  }

  async function createRisk(sectionId: string, finished: boolean) {
    await prisma.risk.create({
      data: {
        reportSectionId: sectionId,
        projectId: PROJECT_ID,
        risk: "Vendor may slip",
        impact: finished ? "Date slips" : null,
        mitigation: finished ? "Second vendor" : null,
        severity: "at-risk",
        stageNames: ["Development"],
      },
    });
  }

  async function createDecision(sectionId: string, finished: boolean) {
    await prisma.decision.create({
      data: {
        reportSectionId: sectionId,
        productId: PROJECT_ID,
        text: "Choose a vendor",
        owner: "owner",
        impact: finished ? "Budget" : null,
        stageNames: ["Development"],
      },
    });
  }

  async function createPublishedReport(id: string, start: string) {
    const date = new Date(start);
    await prisma.report.create({
      data: {
        id,
        periodStart: date,
        periodEnd: date,
        deadline: date,
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: date,
        publishedSnapshot: publishedSnapshotFixture({
          reportId: id,
          periodStart: date,
          periodEnd: date,
          deadline: date,
          publishedAt: date,
        }),
      },
    });
  }

  beforeEach(async () => {
    await cleanDatabase();
    await prisma.reportingGroup.createMany({
      data: [
        { id: GROUP_A, name: "Omission Group A" },
        { id: GROUP_B, name: "Omission Group B" },
      ],
    });
    await createLead(LEAD_A, GROUP_A);
    await createLead(LEAD_B, GROUP_B);
    await prisma.project.create({
      data: { id: PROJECT_ID, name: "Omission platform", leadId: LEAD_A },
    });
    const start = new Date("2036-02-04T00:00:00.000Z");
    await prisma.report.create({
      data: {
        id: OPEN_REPORT,
        periodStart: start,
        periodEnd: start,
        deadline: start,
        status: "draft",
        periodStatus: "open",
      },
    });
    await prisma.reportSection.createMany({
      data: [
        { id: SECTION_A, reportId: OPEN_REPORT, authorId: LEAD_A },
        { id: SECTION_B, reportId: OPEN_REPORT, authorId: LEAD_B },
      ],
    });
    // Lead A: two unfinished risks, one finished risk, one unfinished decision.
    await createRisk(SECTION_A, false);
    await createRisk(SECTION_A, false);
    await createRisk(SECTION_A, true);
    await createDecision(SECTION_A, false);
    await createDecision(SECTION_A, true);
    // Lead B: one unfinished risk and one unfinished decision.
    await createRisk(SECTION_B, false);
    await createDecision(SECTION_B, false);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("counts only the author's own unfinished rows for mine", async () => {
    await expect(
      repository.countOmissions({
        scope: "mine",
        userId: LEAD_A,
        groupIds: [GROUP_A],
        excludeTypes: ["project"],
      }),
    ).resolves.toEqual({ risks: 2, decisions: 1, unknown: false });
  });

  it("limits all to the caller's groups and counts everything unscoped", async () => {
    const all = { scope: "all", userId: LEAD_A, excludeTypes: [] } as const;

    await expect(
      repository.countOmissions({ ...all, groupIds: [GROUP_B] }),
    ).resolves.toEqual({ risks: 1, decisions: 1, unknown: false });
    await expect(
      repository.countOmissions({ ...all, groupIds: null }),
    ).resolves.toEqual({ risks: 3, decisions: 2, unknown: false });
  });

  it("adds nothing for an excluded record kind", async () => {
    await expect(
      repository.countOmissions({
        scope: "mine",
        userId: LEAD_A,
        groupIds: [GROUP_A],
        excludeTypes: ["risk"],
      }),
    ).resolves.toEqual({ risks: 0, decisions: 1, unknown: false });
  });

  it("reads published totals from the frozen scope rows of admitted groups", async () => {
    await createPublishedReport(PUBLISHED_REPORT, "2036-01-07T00:00:00.000Z");
    await prisma.publishedSectionScope.createMany({
      data: [
        {
          reportId: PUBLISHED_REPORT,
          reportSectionId: FROZEN_A,
          authorId: LEAD_A,
          groupId: GROUP_A,
          omittedRisks: 2,
          omittedDecisions: 0,
        },
        {
          reportId: PUBLISHED_REPORT,
          reportSectionId: FROZEN_B,
          authorId: LEAD_B,
          groupId: GROUP_B,
          omittedRisks: 5,
          omittedDecisions: 4,
        },
      ],
    });
    const published = {
      scope: "published",
      userId: LEAD_A,
      excludeTypes: ["project"],
    } as const;

    // Live unfinished rows of the open report never reach the published count.
    await expect(
      repository.countOmissions({ ...published, groupIds: [GROUP_A] }),
    ).resolves.toEqual({ risks: 2, decisions: 0, unknown: false });
    await expect(
      repository.countOmissions({ ...published, groupIds: null }),
    ).resolves.toEqual({ risks: 7, decisions: 4, unknown: false });
  });

  it("answers unknown, never zero, when an admitted section predates the counts", async () => {
    await createPublishedReport(LEGACY_REPORT, "2036-01-14T00:00:00.000Z");
    await prisma.publishedSectionScope.create({
      data: {
        reportId: LEGACY_REPORT,
        reportSectionId: LEGACY_A,
        authorId: LEAD_A,
        groupId: GROUP_A,
      },
    });

    await expect(
      repository.countOmissions({
        scope: "published",
        userId: LEAD_A,
        groupIds: [GROUP_A],
        excludeTypes: ["project"],
      }),
    ).resolves.toEqual({ risks: 0, decisions: 0, unknown: true });
  });
});

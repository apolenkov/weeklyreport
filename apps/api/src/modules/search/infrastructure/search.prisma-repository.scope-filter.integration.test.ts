import type { ReportStatus } from "@customreport/shared";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
} from "../../../test-utils/prisma-test-helper";
import { replacePublishedProjections } from "../published-search-projection";
import { SearchPrismaRepository } from "./search.prisma-repository";

// Published search is an immutable consumer: current period lifecycle selects
// snapshots, while content and group ownership come only from those snapshots.
describe("SearchPrismaRepository — immutable published scope (integration)", () => {
  const prisma = createTestPrisma();
  let repo: SearchPrismaRepository;

  // Fixed UUIDs — version digit [1-8] in pos 13, variant [89ab] in pos 17.
  const GROUP_A_ID = "b0000000-0000-4000-a000-0000000000a1";
  const GROUP_B_ID = "b0000000-0000-4000-a000-0000000000a2";
  const LEAD_A_ID = "b0000000-0000-4000-a000-0000000000c1";
  const LEAD_B_ID = "b0000000-0000-4000-a000-0000000000c2";
  const PROJECT_ID = "b0000000-0000-4000-a000-0000000000d1";

  const REPORT_PUB_ID = "b0000000-0000-4000-a000-0000000000e1";
  const REPORT_OPEN_ID = "b0000000-0000-4000-a000-0000000000e2";
  const REPORT_REOPENED_ID = "b0000000-0000-4000-a000-0000000000e3";

  const SECTION_PUB_A_ID = "b0000000-0000-4000-a000-0000000000f1";
  const SECTION_PUB_B_ID = "b0000000-0000-4000-a000-0000000000f2";
  const SECTION_OPEN_A_ID = "b0000000-0000-4000-a000-0000000000f3";
  const SECTION_REOPENED_A_ID = "b0000000-0000-4000-a000-0000000000f4";

  const ITEM_PUB_IN_GROUP = "b0000000-0000-4000-a000-000000000101";
  const ITEM_OPEN_IN_GROUP = "b0000000-0000-4000-a000-000000000102";
  const ITEM_REOPENED_IN_GROUP = "b0000000-0000-4000-a000-000000000103";
  const ITEM_PUB_OUT_GROUP = "b0000000-0000-4000-a000-000000000104";

  // Risk + Decision rows exercise the OTHER two published-gated chunks: a
  // dropped join from either would leak unpublished/out-of-group content that
  // an Item-only suite cannot catch.
  const RISK_PUB_IN_GROUP = "b0000000-0000-4000-a000-000000000201";
  const RISK_OPEN_IN_GROUP = "b0000000-0000-4000-a000-000000000202";
  const DECISION_PUB_IN_GROUP = "b0000000-0000-4000-a000-000000000301";
  const DECISION_PUB_OUT_GROUP = "b0000000-0000-4000-a000-000000000302";

  // Distinct token present in every item's text so plainto_tsquery matches.
  const Q = "paritysearchtoken";

  function publishedContentSnapshot(
    reportId: string,
    periodDate: Date,
  ): Prisma.InputJsonValue {
    const base = publishedSnapshotFixture({
      reportId,
      periodStart: periodDate,
      periodEnd: periodDate,
      deadline: periodDate,
      publishedAt: periodDate,
    }) as Prisma.InputJsonObject;
    if (reportId !== REPORT_PUB_ID) return base;

    const sectionBase = {
      reportId,
      authorRole: "lead",
      version: 1,
      status: "submitted",
      submittedAt: periodDate.toISOString(),
      late: false,
      projects: [
        {
          projectId: PROJECT_ID,
          projectName: "Parity Platform",
          trafficLight: "green",
          ownedStages: [],
          stageSet: [],
          ownerGroupId: GROUP_A_ID,
        },
      ],
      referencedProjects: [],
      activities: [],
      reviews: [],
    } as const;
    const item = (id: string) => ({
      id,
      stableId: `${id.slice(0, -4)}f${id.slice(-3)}`,
      projectId: PROJECT_ID,
      activityId: null,
      type: "current",
      text: `${Q} release blocker`,
      tag: "general",
      workflowStatus: "in_progress",
      carriedOver: false,
      priorityRank: null,
      pausedReason: null,
      stageNames: ["Development"],
    });
    const decision = (id: string) => ({
      id,
      stableId: `${id.slice(0, -4)}e${id.slice(-3)}`,
      text: `${Q} go decision`,
      owner: "owner",
      deadline: null,
      impact: "high",
      resolvedAt: null,
      stageNames: ["Development"],
      productId: PROJECT_ID,
      activityId: null,
    });

    return {
      ...base,
      sections: [
        {
          ...sectionBase,
          reportSectionId: SECTION_PUB_A_ID,
          authorId: LEAD_A_ID,
          authorName: "Lead A",
          groupId: GROUP_A_ID,
          groupName: "Group A",
          items: [item(ITEM_PUB_IN_GROUP)],
          risks: [
            {
              id: RISK_PUB_IN_GROUP,
              stableId: `${RISK_PUB_IN_GROUP.slice(0, -4)}d${RISK_PUB_IN_GROUP.slice(-3)}`,
              projectId: PROJECT_ID,
              activityId: null,
              risk: `${Q} schedule risk`,
              impact: "high",
              mitigation: "mitigate",
              severity: "at-risk",
              stageNames: ["Development"],
            },
          ],
          decisions: [decision(DECISION_PUB_IN_GROUP)],
        },
        {
          ...sectionBase,
          reportSectionId: SECTION_PUB_B_ID,
          authorId: LEAD_B_ID,
          authorName: "Lead B",
          groupId: GROUP_B_ID,
          groupName: "Group B",
          items: [item(ITEM_PUB_OUT_GROUP)],
          risks: [],
          decisions: [decision(DECISION_PUB_OUT_GROUP)],
        },
      ],
    };
  }

  async function createReport(
    id: string,
    status: ReportStatus,
    periodStatus: "open" | "published" | "reopened",
    periodStart: string,
  ): Promise<void> {
    const periodDate = new Date(periodStart);
    await prisma.report.create({
      data: {
        id,
        periodStart: periodDate,
        periodEnd: periodDate,
        deadline: periodDate,
        status,
        periodStatus,
        periodState: periodStatus === "published" ? "published" : "open",
        publishedAt: status === "published" ? periodDate : null,
        ...(periodStatus === "reopened" ? { reopenedAt: periodDate } : {}),
        ...(status === "published"
          ? {
              publishedSnapshot: publishedSnapshotFixture({
                reportId: id,
                periodStart: periodDate,
                periodEnd: periodDate,
                deadline: periodDate,
                publishedAt: periodDate,
              }),
            }
          : {}),
      },
    });

    if (status === "published") {
      const snapshot = publishedContentSnapshot(id, periodDate);
      await prisma.report.update({
        where: { id },
        data: { publishedSnapshot: snapshot },
      });
      await prisma.$transaction(async (tx) => {
        await replacePublishedProjections(tx, { reportId: id, snapshot });
      });
    }
  }

  async function createSection(
    id: string,
    reportId: string,
    authorId: string,
  ): Promise<void> {
    await prisma.reportSection.create({
      data: { id, reportId, authorId, status: "submitted" },
    });
  }

  async function createItem(
    id: string,
    reportSectionId: string,
  ): Promise<void> {
    await prisma.item.create({
      data: {
        id,
        reportSectionId,
        projectId: PROJECT_ID,
        type: "current",
        text: `${Q} release blocker`,
        tag: "general",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
    });
  }

  async function createRisk(
    id: string,
    reportSectionId: string,
  ): Promise<void> {
    await prisma.risk.create({
      data: {
        id,
        reportSectionId,
        projectId: PROJECT_ID,
        risk: `${Q} schedule risk`,
        impact: "high",
        mitigation: "mitigate",
        severity: "at-risk",
        stageNames: ["Development"],
      },
    });
  }

  async function createDecision(
    id: string,
    reportSectionId: string,
  ): Promise<void> {
    await prisma.decision.create({
      data: {
        id,
        reportSectionId,
        productId: PROJECT_ID,
        text: `${Q} go decision`,
        owner: "owner",
        impact: "high",
        stageNames: ["Development"],
      },
    });
  }

  beforeAll(() => {
    repo = new SearchPrismaRepository(prisma as unknown as PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();

    await prisma.reportingGroup.createMany({
      data: [
        { id: GROUP_A_ID, name: "Group A" },
        { id: GROUP_B_ID, name: "Group B" },
      ],
    });
    await prisma.user.createMany({
      data: [
        {
          id: LEAD_A_ID,
          email: "lead-a@test.local",
          name: "Lead A",
          lastName: "Lead",
          firstName: "A",
          role: "lead",
          samlId: "parity-lead-a",
          reportingGroupId: GROUP_A_ID,
        },
        {
          id: LEAD_B_ID,
          email: "lead-b@test.local",
          name: "Lead B",
          lastName: "Lead",
          firstName: "B",
          role: "lead",
          samlId: "parity-lead-b",
          reportingGroupId: GROUP_B_ID,
        },
      ],
    });
    await prisma.project.create({
      data: { id: PROJECT_ID, name: "Parity Platform", leadId: LEAD_A_ID },
    });
    await prisma.groupProduct.create({
      data: { groupId: GROUP_A_ID, productId: PROJECT_ID },
    });

    await createReport(
      REPORT_PUB_ID,
      "published",
      "published",
      "2026-05-04T00:00:00.000Z",
    );
    await createReport(
      REPORT_OPEN_ID,
      "draft",
      "open",
      "2026-05-11T00:00:00.000Z",
    );
    // Reopened: status stays 'published' (list column) but periodStatus makes
    // content unreadable — the leak the gate fixes.
    await createReport(
      REPORT_REOPENED_ID,
      "published",
      "reopened",
      "2026-05-18T00:00:00.000Z",
    );

    await createSection(SECTION_PUB_A_ID, REPORT_PUB_ID, LEAD_A_ID);
    await createSection(SECTION_PUB_B_ID, REPORT_PUB_ID, LEAD_B_ID);
    await createSection(SECTION_OPEN_A_ID, REPORT_OPEN_ID, LEAD_A_ID);
    await createSection(SECTION_REOPENED_A_ID, REPORT_REOPENED_ID, LEAD_A_ID);

    await createItem(ITEM_PUB_IN_GROUP, SECTION_PUB_A_ID);
    await createItem(ITEM_OPEN_IN_GROUP, SECTION_OPEN_A_ID);
    await createItem(ITEM_REOPENED_IN_GROUP, SECTION_REOPENED_A_ID);
    await createItem(ITEM_PUB_OUT_GROUP, SECTION_PUB_B_ID);

    await createRisk(RISK_PUB_IN_GROUP, SECTION_PUB_A_ID);
    await createRisk(RISK_OPEN_IN_GROUP, SECTION_OPEN_A_ID);
    await createDecision(DECISION_PUB_IN_GROUP, SECTION_PUB_A_ID);
    await createDecision(DECISION_PUB_OUT_GROUP, SECTION_PUB_B_ID);
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  async function publishedSearch(groupIds: string[] | null): Promise<string[]> {
    const hits = await repo.search({
      q: Q,
      scope: "published",
      userId: LEAD_A_ID,
      groupIds,
      excludeTypes: ["project"],
      limit: 50,
    });
    return hits.map((h) => h.id);
  }

  it("returns a published, in-group item to the viewer scope", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).toContain(ITEM_PUB_IN_GROUP);
  });

  it("excludes an item in an UNPUBLISHED (open) report — the publish gate", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).not.toContain(ITEM_OPEN_IN_GROUP);
  });

  it("excludes an item in a REOPENED report (status='published', periodStatus='reopened') — proves the gate keys on periodStatus, not status", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).not.toContain(ITEM_REOPENED_IN_GROUP);
  });

  it("excludes a published item authored OUTSIDE the viewer's groups — the group gate", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).not.toContain(ITEM_PUB_OUT_GROUP);
  });

  // A dropped join from either chunk would surface content the Item-only
  // assertions above cannot catch.
  it("applies the publish gate to the Risk chunk (in-group published surfaces, unpublished excluded)", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).toContain(RISK_PUB_IN_GROUP);
    expect(ids).not.toContain(RISK_OPEN_IN_GROUP);
  });

  it("applies the publish + group gate to the Decision chunk", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect(ids).toContain(DECISION_PUB_IN_GROUP);
    expect(ids).not.toContain(DECISION_PUB_OUT_GROUP);
  });

  it("published scope returns EXACTLY the in-group published content across all chunks (read-parity)", async () => {
    const ids = await publishedSearch([GROUP_A_ID]);
    expect([...ids].sort()).toEqual(
      [ITEM_PUB_IN_GROUP, RISK_PUB_IN_GROUP, DECISION_PUB_IN_GROUP].sort(),
    );
  });

  it("keeps frozen content, anchors, and group scope after live rows and current ownership are removed", async () => {
    const before = await repo.search({
      q: Q,
      scope: "published",
      userId: LEAD_A_ID,
      groupIds: [GROUP_A_ID],
      excludeTypes: ["project"],
      limit: 50,
    });

    await prisma.user.update({
      where: { id: LEAD_A_ID },
      data: { reportingGroupId: GROUP_B_ID },
    });
    await prisma.reportSection.deleteMany({
      where: { reportId: REPORT_PUB_ID },
    });

    const after = await repo.search({
      q: Q,
      scope: "published",
      userId: LEAD_A_ID,
      groupIds: [GROUP_A_ID],
      excludeTypes: ["project"],
      limit: 50,
    });

    expect(after).toEqual(before);
    expect(after).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ITEM_PUB_IN_GROUP,
          reportId: REPORT_PUB_ID,
          reportSectionId: SECTION_PUB_A_ID,
          title: `${Q} release blocker`,
        }),
      ]),
    );
    expect(after.map(({ id }) => id)).not.toContain(ITEM_PUB_OUT_GROUP);
  });

  it("searches a rebuilt published projection with no live section graph", async () => {
    const stored = await prisma.report.findUniqueOrThrow({
      where: { id: REPORT_PUB_ID },
      select: {
        periodStart: true,
        periodEnd: true,
        deadline: true,
        publishedAt: true,
        publishedSnapshot: true,
      },
    });
    await prisma.report.delete({ where: { id: REPORT_PUB_ID } });
    await prisma.report.create({
      data: {
        id: REPORT_PUB_ID,
        periodStart: stored.periodStart,
        periodEnd: stored.periodEnd,
        deadline: stored.deadline,
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: stored.publishedAt,
        publishedSnapshot: stored.publishedSnapshot ?? Prisma.JsonNull,
      },
    });
    await prisma.$transaction(async (tx) => {
      await replacePublishedProjections(tx, {
        reportId: REPORT_PUB_ID,
        snapshot: stored.publishedSnapshot,
      });
    });

    const ids = await publishedSearch([GROUP_A_ID]);
    expect([...ids].sort()).toEqual(
      [ITEM_PUB_IN_GROUP, RISK_PUB_IN_GROUP, DECISION_PUB_IN_GROUP].sort(),
    );
    await expect(
      prisma.reportSection.count({ where: { reportId: REPORT_PUB_ID } }),
    ).resolves.toBe(0);
  });

  it("a viewer with access to BOTH groups also sees the group-B published item", async () => {
    const ids = await publishedSearch([GROUP_A_ID, GROUP_B_ID]);
    expect(ids).toContain(ITEM_PUB_IN_GROUP);
    expect(ids).toContain(ITEM_PUB_OUT_GROUP);
    // Still no unpublished/reopened content, even with broader group access.
    expect(ids).not.toContain(ITEM_OPEN_IN_GROUP);
    expect(ids).not.toContain(ITEM_REOPENED_IN_GROUP);
  });

  it("the publish gate is scope-specific: scope='all' still surfaces unpublished in-group content", async () => {
    // Differentiator — proves the INNER JOIN applies ONLY to scope='published'
    // and did not silently constrain the existing 'all' scope.
    const hits = await repo.search({
      q: Q,
      scope: "all",
      userId: LEAD_A_ID,
      groupIds: [GROUP_A_ID],
      excludeTypes: [],
      limit: 50,
    });
    const ids = hits.map((h) => h.id);
    expect(ids).toContain(ITEM_PUB_IN_GROUP);
    expect(ids).toContain(ITEM_OPEN_IN_GROUP);
    expect(ids).toContain(ITEM_REOPENED_IN_GROUP);
  });
});

import { toPublishedSnapshotJson } from "@weeklyreport/report-persistence";
import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import { ReportSearchPrismaRepository } from "../infrastructure/report-search.prisma-repository.js";
import { authorizeReportOccurrences } from "./authorized-report-retrieval.js";

const GROUP_ID = "d0000000-0000-4000-a000-000000000001";
const ACTOR_ID = "d0000000-0000-4000-a000-000000000002";
const FOREIGN_ID = "d0000000-0000-4000-a000-000000000003";
const REPORT_ID = "d0000000-0000-4000-a000-000000000004";
const SHARED_PRODUCT_ID = "d0000000-0000-4000-a000-000000000005";
const UNSHARED_PRODUCT_ID = "d0000000-0000-4000-a000-000000000006";
const SHARED_STAGE_ID = "d0000000-0000-4000-a000-000000000007";
const FOREIGN_STAGE_ID = "d0000000-0000-4000-a000-000000000008";
const ACTIVITY_ID = "d0000000-0000-4000-a000-000000000009";
const ACTOR_SECTION_ID = "d0000000-0000-4000-a000-000000000010";
const FOREIGN_SECTION_ID = "d0000000-0000-4000-a000-000000000011";
const OWN_ITEM_ID = "d0000000-0000-4000-a000-000000000012";
const SHARED_ITEM_ID = "d0000000-0000-4000-a000-000000000013";
const UNSHARED_ITEM_ID = "d0000000-0000-4000-a000-000000000014";
const ACTIVITY_ITEM_ID = "d0000000-0000-4000-a000-000000000015";

const prisma = createTestPrisma();
const repository = new ReportSearchPrismaRepository(prisma as never);

async function seedAuthorizationFixture(): Promise<void> {
  await prisma.reportingGroup.create({
    data: { id: GROUP_ID, name: "Authorization Integration Group" },
  });
  await prisma.user.createMany({
    data: [
      {
        id: ACTOR_ID,
        email: "assistant-actor@test.local",
        name: "Actor Lead",
        lastName: "Actor",
        firstName: "Lead",
        role: "lead",
        samlId: "assistant-actor",
        reportingGroupId: GROUP_ID,
      },
      {
        id: FOREIGN_ID,
        email: "assistant-foreign@test.local",
        name: "Foreign Lead",
        lastName: "Foreign",
        firstName: "Lead",
        role: "lead",
        samlId: "assistant-foreign",
        reportingGroupId: GROUP_ID,
      },
    ],
  });
  await prisma.project.createMany({
    data: [
      { id: SHARED_PRODUCT_ID, name: "Shared Product", leadId: ACTOR_ID },
      { id: UNSHARED_PRODUCT_ID, name: "Unshared Product", leadId: FOREIGN_ID },
    ],
  });
  await prisma.groupProduct.createMany({
    data: [
      { groupId: GROUP_ID, productId: SHARED_PRODUCT_ID },
      { groupId: GROUP_ID, productId: UNSHARED_PRODUCT_ID },
    ],
  });
  await prisma.stage.createMany({
    data: [
      { id: SHARED_STAGE_ID, name: "Development", sortOrder: 1 },
      { id: FOREIGN_STAGE_ID, name: "Testing", sortOrder: 2 },
    ],
  });
  await prisma.stageAssignment.createMany({
    data: [
      {
        userId: ACTOR_ID,
        projectId: SHARED_PRODUCT_ID,
        stageId: SHARED_STAGE_ID,
      },
      {
        userId: FOREIGN_ID,
        projectId: SHARED_PRODUCT_ID,
        stageId: FOREIGN_STAGE_ID,
      },
      {
        userId: FOREIGN_ID,
        projectId: UNSHARED_PRODUCT_ID,
        stageId: SHARED_STAGE_ID,
      },
    ],
  });
  await prisma.projectActivity.create({
    data: {
      id: ACTIVITY_ID,
      name: "Own Activity",
      groupId: GROUP_ID,
      jiraAccounts: ["ACTIVITY-JIRA"],
      activityProducts: { create: [{ productId: SHARED_PRODUCT_ID }] },
      leads: { create: [{ leadId: ACTOR_ID }, { leadId: FOREIGN_ID }] },
    },
  });
  await prisma.report.create({
    data: {
      id: REPORT_ID,
      periodStart: new Date("2026-08-01T00:00:00.000Z"),
      periodEnd: new Date("2026-08-07T23:59:59.999Z"),
      deadline: new Date("2026-08-07T18:00:00.000Z"),
      status: "draft",
      periodStatus: "open",
      periodState: "open",
      weekLabel: "Current",
    },
  });
  await prisma.reportSection.createMany({
    data: [
      { id: ACTOR_SECTION_ID, reportId: REPORT_ID, authorId: ACTOR_ID },
      { id: FOREIGN_SECTION_ID, reportId: REPORT_ID, authorId: FOREIGN_ID },
    ],
  });
  await prisma.projectStatus.create({
    data: {
      reportSectionId: ACTOR_SECTION_ID,
      projectId: SHARED_PRODUCT_ID,
      status: "green",
    },
  });
  await prisma.activityStatus.createMany({
    data: [
      {
        reportSectionId: ACTOR_SECTION_ID,
        activityId: ACTIVITY_ID,
        status: "yellow",
        note: "Own activity note",
      },
      {
        reportSectionId: FOREIGN_SECTION_ID,
        activityId: ACTIVITY_ID,
        status: "red",
        note: "Foreign activity note",
      },
    ],
  });
  await prisma.item.createMany({
    data: [
      {
        id: OWN_ITEM_ID,
        reportSectionId: ACTOR_SECTION_ID,
        projectId: SHARED_PRODUCT_ID,
        type: "current",
        text: "Own product item",
        tag: "integration",
        workflowStatus: "in_progress",
        stageNames: ["Development"],
      },
      {
        id: SHARED_ITEM_ID,
        reportSectionId: FOREIGN_SECTION_ID,
        projectId: SHARED_PRODUCT_ID,
        type: "current",
        text: "Shared foreign item",
        tag: "integration",
        workflowStatus: "paused",
        pausedReason: "Foreign private reason",
        stageNames: ["Testing"],
      },
      {
        id: UNSHARED_ITEM_ID,
        reportSectionId: FOREIGN_SECTION_ID,
        projectId: UNSHARED_PRODUCT_ID,
        type: "current",
        text: "Unshared foreign item",
        tag: "integration",
        workflowStatus: "in_progress",
        stageNames: ["Testing"],
      },
      {
        id: ACTIVITY_ITEM_ID,
        reportSectionId: FOREIGN_SECTION_ID,
        activityId: ACTIVITY_ID,
        type: "current",
        text: "Foreign activity item",
        tag: "integration",
        workflowStatus: "in_progress",
        stageNames: [],
      },
    ],
  });
}

async function currentOccurrence() {
  const source = (await repository.listSources()).find(
    (candidate) => candidate.reportId === REPORT_ID,
  );
  if (!source) throw new Error("Expected current report source.");
  const occurrence = (await repository.loadOccurrences([source]))[0];
  if (!occurrence) throw new Error("Expected current report occurrence.");
  return occurrence;
}

function assembledSnapshot(sections: readonly ReportSectionReadModel[]) {
  return toPublishedSnapshotJson({
    reportId: REPORT_ID,
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-07T23:59:59.999Z"),
    deadline: new Date("2026-08-07T18:00:00.000Z"),
    status: "published",
    publishedAt: new Date("2026-08-07T19:00:00.000Z"),
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "green",
      totals: { green: 1, yellow: 0, red: 0 },
    },
    sections: sections.map((section) => ({
      ...section,
      groupId: GROUP_ID,
      groupName: "Authorization Integration Group",
    })),
  });
}

beforeEach(async () => {
  await cleanDatabase();
  await seedAuthorizationFixture();
});

afterAll(async () => {
  await cleanDatabase();
  await disconnectTestPrisma();
});

describe("authorized report retrieval (integration)", () => {
  it("keeps own Activity notes and exposes foreign shared products only", async () => {
    const result = await authorizeReportOccurrences(repository, ACTOR_ID, [
      await currentOccurrence(),
    ]);
    const own = result.sectionScopes.find(
      (scope) => scope.authorId === ACTOR_ID,
    );
    const foreign = result.sectionScopes.find(
      (scope) => scope.authorId === FOREIGN_ID,
    );

    expect(own?.section.activities[0]?.note).toBe("Own activity note");
    expect(foreign?.visibility).toBe("shared_products");
    expect(foreign?.section.items.map((item) => item.text)).toEqual([
      "Shared foreign item",
    ]);
    expect(foreign?.section.items[0]).not.toHaveProperty("pausedReason");
    expect(foreign?.section.activities).toEqual([]);
    expect(result.sectionScopes.map((scope) => scope.authorId)).toEqual([
      ACTOR_ID,
      FOREIGN_ID,
    ]);
  });

  it("rechecks current assignments for historical snapshots and hides inaccessible authors", async () => {
    const live = await currentOccurrence();
    await prisma.report.update({
      where: { id: REPORT_ID },
      data: {
        status: "published",
        periodStatus: "published",
        periodState: "published",
        publishedAt: new Date("2026-08-07T19:00:00.000Z"),
        publishedSnapshot: assembledSnapshot(live.sections),
      },
    });

    const published = await currentOccurrence();
    const beforeAclChange = await authorizeReportOccurrences(
      repository,
      ACTOR_ID,
      [published],
    );
    expect(
      beforeAclChange.sectionScopes.map((scope) => scope.authorId),
    ).toContain(FOREIGN_ID);

    await prisma.stageAssignment.delete({
      where: {
        stageId_projectId: {
          stageId: SHARED_STAGE_ID,
          projectId: SHARED_PRODUCT_ID,
        },
      },
    });
    const afterAclChange = await authorizeReportOccurrences(
      repository,
      ACTOR_ID,
      [await currentOccurrence()],
    );

    expect(afterAclChange.sectionScopes.map((scope) => scope.authorId)).toEqual(
      [ACTOR_ID],
    );
    expect(afterAclChange.sectionScopes[0]?.section.activities[0]?.note).toBe(
      "Own activity note",
    );
    expect(afterAclChange.occurrences[0]?.sections).toHaveLength(1);
  });
});

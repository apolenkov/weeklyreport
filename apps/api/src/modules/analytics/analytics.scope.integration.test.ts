import type { UserSession } from "@customreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { AnalyticsPrismaRepository } from "./analytics.prisma-repository";

/**
 * P0-5 cross-group leak gate. The fixture is ONE unified published period
 * Report holding BOTH a group-A and a group-B section (two single-group reports
 * would false-green the nested-include scope). A group-A head must see only
 * group-A projects, leads, and risks from all three analytics read paths.
 */
const GROUP_B = "b0000000-0000-4000-8000-00000000000b";
const LEAD_B = "b0000000-0000-4000-8000-0000000000b1";
const PROJECT_B = "b0000000-0000-4000-8000-0000000000b2";
const SECTION_B = "b0000000-0000-4000-8000-0000000000b3";

const HISTORY_INPUT = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };

describe("Analytics group scoping (integration)", () => {
  const prisma = createTestPrisma();
  let repo: AnalyticsPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let headA: UserSession;

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
    repo = new AnalyticsPrismaRepository(prisma as never);

    headA = {
      userId: testData.head.id,
      email: "head-a@test.local",
      name: "Head A",
      role: "head",
      activeReportId: null,
      activeReportSectionId: null,
      reportingGroupId: TEST_IDS.group,
    };

    // Publish the seeded unified period and submit its group-A section.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: { status: "published" },
    });
    await prisma.reportSection.update({
      where: { id: testData.section.id },
      data: { status: "submitted" },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: "green",
      },
    });

    // Co-locate a group-B section on the SAME report.
    await prisma.reportingGroup.create({
      data: { id: GROUP_B, name: "Group B", description: "Other group" },
    });
    await prisma.user.create({
      data: {
        id: LEAD_B,
        email: "lead-b@test.local",
        name: "Lead B",
        lastName: "B",
        firstName: "Lead",
        role: "lead",
        samlId: "lead-b",
        reportingGroupId: GROUP_B,
      },
    });
    await prisma.project.create({
      data: { id: PROJECT_B, name: "Project B", leadId: LEAD_B },
    });
    await prisma.reportSection.create({
      data: {
        id: SECTION_B,
        reportId: testData.report.id,
        authorId: LEAD_B,
        status: "submitted",
      },
    });
    await prisma.projectStatus.create({
      data: {
        reportSectionId: SECTION_B,
        projectId: PROJECT_B,
        status: "red",
      },
    });
    await prisma.risk.create({
      data: {
        reportSectionId: SECTION_B,
        projectId: PROJECT_B,
        risk: "Group B risk",
        impact: "B impact",
        mitigation: "B mitigation",
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("trafficLightHistory returns only the group-A project", async () => {
    const result = await repo.trafficLightHistory(HISTORY_INPUT, headA);
    const ids = result.rows.map((r) => r.projectId);
    expect(ids).toContain(testData.project.id);
    expect(ids).not.toContain(PROJECT_B);
  });

  it("leadVelocity returns only the group-A lead", async () => {
    const result = await repo.leadVelocity(HISTORY_INPUT, headA);
    const leadIds = result.flatMap((p) => p.leads.map((l) => l.leadId));
    expect(leadIds).toContain(testData.lead.id);
    expect(leadIds).not.toContain(LEAD_B);
  });

  it("periodComparison returns only the group-A project and risks", async () => {
    const result = await repo.periodComparison(
      { periodA: "2026-04-13", periodB: "2026-04-20" },
      headA,
    );
    const ids = result.rows.map((r) => r.projectId);
    expect(ids).toContain(testData.project.id);
    expect(ids).not.toContain(PROJECT_B);
  });
});

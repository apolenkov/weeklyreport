import type { TrafficLightStatus } from "@customreport/shared";
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

// Cross-group leak gate: the fixture is deliberately ONE unified published
// Report holding BOTH a group-A and a group-B section, because two
// single-group reports would false-green the nested-include scope.
const GROUP_B = "b0000000-0000-4000-8000-00000000000b";
const LEAD_B = "b0000000-0000-4000-8000-0000000000b1";
const PROJECT_B = "b0000000-0000-4000-8000-0000000000b2";
const SECTION_B = "b0000000-0000-4000-8000-0000000000b3";

const HISTORY_INPUT = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };

// Real-Postgres day-range gate on a stored full-timestamp `periodEnd`; admin
// session so group scoping cannot confound it. Must stay FIRST in the file: the
// group-scoping block runs last and owns the one `disconnectTestPrisma()`.
const DR_GROUP = "c0000000-0000-4000-8000-00000000000c";
const DR_LEAD = "c0000000-0000-4000-8000-0000000000c1";
const DR_PROJECT = "c0000000-0000-4000-8000-0000000000c2";

const adminDR: UserSession = {
  userId: "c0000000-0000-4000-8000-0000000000c3",
  email: "admin-dr@test.local",
  name: "Admin DR",
  role: "admin",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: DR_GROUP,
};

const MAY = { periodFrom: "2026-05-01", periodTo: "2026-05-31" };

describe("Analytics day-range matching (integration)", () => {
  const prisma = createTestPrisma();
  let repo: AnalyticsPrismaRepository;

  async function makePublishedReport(args: {
    id: string;
    sectionId: string;
    periodStart: string;
    periodEnd: string;
    createdAt?: string;
    sectionStatus: "submitted" | "draft";
    projectStatus?: TrafficLightStatus;
    risks?: number;
  }): Promise<void> {
    await prisma.report.create({
      data: {
        id: args.id,
        periodStart: new Date(args.periodStart),
        periodEnd: new Date(args.periodEnd),
        deadline: new Date(args.periodEnd),
        status: "published",
        periodState: "published",
        periodStatus: "published",
        ...(args.createdAt ? { createdAt: new Date(args.createdAt) } : {}),
      },
    });
    await prisma.reportSection.create({
      data: {
        id: args.sectionId,
        reportId: args.id,
        authorId: DR_LEAD,
        status: args.sectionStatus,
      },
    });
    if (args.projectStatus) {
      await prisma.projectStatus.create({
        data: {
          reportSectionId: args.sectionId,
          projectId: DR_PROJECT,
          status: args.projectStatus,
        },
      });
    }
    await Promise.all(
      Array.from({ length: args.risks ?? 0 }, (_unused, i) =>
        prisma.risk.create({
          data: {
            reportSectionId: args.sectionId,
            projectId: DR_PROJECT,
            risk: `risk ${String(i)}`,
            impact: "impact",
            mitigation: "mitigation",
            severity: "at-risk",
            stageNames: [],
          },
        }),
      ),
    );
  }

  beforeEach(async () => {
    await cleanDatabase(prisma);
    repo = new AnalyticsPrismaRepository(prisma as never);
    await prisma.reportingGroup.create({
      data: { id: DR_GROUP, name: "DR Group", description: "Date-range group" },
    });
    await prisma.user.create({
      data: {
        id: DR_LEAD,
        email: "lead-dr@test.local",
        name: "Lead DR",
        lastName: "DR",
        firstName: "Lead",
        role: "lead",
        samlId: "lead-dr",
        reportingGroupId: DR_GROUP,
      },
    });
    await prisma.project.create({
      data: { id: DR_PROJECT, name: "DR Project", leadId: DR_LEAD },
    });
  });

  it("periodComparison matches a non-midnight periodEnd by its date-only label", async () => {
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000201",
      sectionId: "c0000000-0000-4000-8000-000000000202",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T15:30:00.000Z",
      sectionStatus: "submitted",
      projectStatus: "green",
    });

    const result = await repo.periodComparison(
      { periodA: "2026-05-10", periodB: "2026-05-17" },
      adminDR,
    );

    const row = result.rows.find((r) => r.projectId === DR_PROJECT);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(row?.statusA).toBe("green");
  });

  it("trafficLightHistory aggregates two reports under one label with a deterministic tie-break", async () => {
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000301",
      sectionId: "c0000000-0000-4000-8000-000000000302",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T08:00:00.000Z",
      sectionStatus: "submitted",
      projectStatus: "green",
    });
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000303",
      sectionId: "c0000000-0000-4000-8000-000000000304",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T20:00:00.000Z",
      sectionStatus: "submitted",
      projectStatus: "red",
    });

    const first = await repo.trafficLightHistory(MAY, adminDR);
    const second = await repo.trafficLightHistory(MAY, adminDR);

    const labelIdx = first.periods.indexOf("2026-05-10");
    const row = first.rows.find((r) => r.projectId === DR_PROJECT);
    // Latest periodEnd (20:00, red) wins over the earlier (08:00, green).
    expect(row?.statuses[labelIdx]).toBe("red");
    expect(first).toEqual(second);
  });

  it("periodComparison counts risks only from the authoritative republish", async () => {
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000401",
      sectionId: "c0000000-0000-4000-8000-000000000402",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T08:00:00.000Z",
      sectionStatus: "submitted",
      projectStatus: "green",
      risks: 1,
    });
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000403",
      sectionId: "c0000000-0000-4000-8000-000000000404",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T20:00:00.000Z",
      sectionStatus: "submitted",
      projectStatus: "red",
      risks: 1,
    });

    const result = await repo.periodComparison(
      { periodA: "2026-05-10", periodB: "2026-05-17" },
      adminDR,
    );

    const row = result.rows.find((r) => r.projectId === DR_PROJECT);
    expect(row?.riskCountA).toBe(1);
    expect(row?.statusA).toBe("red");
  });

  it("breaks an identical-periodEnd tie by the later createdAt", async () => {
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000601",
      sectionId: "c0000000-0000-4000-8000-000000000602",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T12:00:00.000Z",
      createdAt: "2026-05-11T00:00:00.000Z",
      sectionStatus: "submitted",
      projectStatus: "green",
    });
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000603",
      sectionId: "c0000000-0000-4000-8000-000000000604",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T12:00:00.000Z",
      createdAt: "2026-05-12T00:00:00.000Z",
      sectionStatus: "submitted",
      projectStatus: "red",
    });

    const result = await repo.trafficLightHistory(MAY, adminDR);
    const labelIdx = result.periods.indexOf("2026-05-10");
    const row = result.rows.find((r) => r.projectId === DR_PROJECT);
    // periodEnd ties; the later createdAt (red) wins.
    expect(row?.statuses[labelIdx]).toBe("red");
  });

  it("includes a non-midnight periodEnd on the periodTo day in history and velocity", async () => {
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000501",
      sectionId: "c0000000-0000-4000-8000-000000000502",
      periodStart: "2026-05-25",
      periodEnd: "2026-05-31T18:00:00.000Z",
      sectionStatus: "submitted",
      projectStatus: "green",
    });

    const history = await repo.trafficLightHistory(MAY, adminDR);
    expect(history.periods).toContain("2026-05-31");
    expect(history.rows.some((r) => r.projectId === DR_PROJECT)).toBe(true);

    const velocity = await repo.leadVelocity(MAY, adminDR);
    const finalDay = velocity.find((p) => p.periodLabel === "2026-05-31");
    expect(finalDay?.leads.map((l) => l.leadId)).toContain(DR_LEAD);
  });

  it("leadVelocity collapses a republished period into one row", async () => {
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000701",
      sectionId: "c0000000-0000-4000-8000-000000000702",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T08:00:00.000Z",
      sectionStatus: "submitted",
    });
    await makePublishedReport({
      id: "c0000000-0000-4000-8000-000000000703",
      sectionId: "c0000000-0000-4000-8000-000000000704",
      periodStart: "2026-05-04",
      periodEnd: "2026-05-10T20:00:00.000Z",
      sectionStatus: "submitted",
    });

    const velocity = await repo.leadVelocity(MAY, adminDR);
    const rows = velocity.filter((p) => p.periodLabel === "2026-05-10");
    // Two reports share the 2026-05-10 label — grouping yields ONE row, and a
    // lead submitted in BOTH the original and the republish counts ONCE in it
    // (not one entry per report, which would overstate that lead's velocity).
    expect(rows).toHaveLength(1);
    expect(rows[0]?.leads).toHaveLength(1);
    expect(rows[0]?.leads[0]?.leadId).toBe(DR_LEAD);
  });
});

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
      data: { status: "published", periodStatus: "published" },
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
        severity: "at-risk",
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

  it("trafficLightHistory with a leadId set aggregates only that lead's projects", async () => {
    // Admin session: no group scope, so the lead filter is the ONLY predicate —
    // it must scope which sections aggregate, not just which reports qualify.
    const adminA: UserSession = { ...headA, role: "admin" };
    const result = await repo.trafficLightHistory(
      { ...HISTORY_INPUT, leadId: testData.lead.id },
      adminA,
    );
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

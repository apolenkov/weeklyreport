import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AnalyticsPrismaRepository } from "./analytics.prisma-repository";

const REPORT_ID = "10000000-0000-4000-8000-000000000001";
const PROJECT_ID = "20000000-0000-4000-8000-000000000002";
const LEAD_ID = "30000000-0000-4000-8000-000000000003";
const SECTION_ID = "50000000-0000-4000-8000-000000000005";
const GROUP_ID = "60000000-0000-4000-8000-000000000006";
const PERIOD = "2026-04-21";
const RANGE = { periodFrom: "2026-04-01", periodTo: "2026-04-30" };
const adminSession: UserSession = {
  userId: "40000000-0000-4000-8000-000000000004",
  email: "admin@test.local",
  name: "Admin",
  role: "admin",
  activeReportId: null,
  activeReportSectionId: null,
  reportingGroupId: undefined,
};

const editedReport = {
  id: REPORT_ID,
  periodEnd: new Date("2026-04-21T12:00:00.000Z"),
  createdAt: new Date("2026-04-22T12:00:00.000Z"),
  publishedSnapshot: {
    reportId: REPORT_ID,
    periodStart: "2026-04-15T00:00:00.000Z",
    periodEnd: "2026-04-21T12:00:00.000Z",
    deadline: "2026-04-20T00:00:00.000Z",
    status: "published",
    publishedAt: "2026-04-21T13:00:00.000Z",
    publishedById: null,
    publishedByName: null,
    portfolioOverview: {
      status: "red",
      totals: { green: 0, yellow: 0, red: 1 },
    },
    sections: [
      {
        reportSectionId: SECTION_ID,
        reportId: REPORT_ID,
        authorId: LEAD_ID,
        authorName: "Lead",
        authorRole: "lead",
        version: 1,
        status: "submitted",
        submittedAt: "2026-04-21T11:00:00.000Z",
        late: false,
        projects: [
          {
            projectId: PROJECT_ID,
            projectName: "Edited",
            trafficLight: "red",
            ownedStages: [],
            stageSet: [],
            ownerGroupId: GROUP_ID,
          },
        ],
        referencedProjects: [],
        items: [],
        risks: [],
        decisions: [],
        activities: [],
        reviews: [],
        groupId: GROUP_ID,
        groupName: "Group",
      },
    ],
  },
};

function repositoryFor(periodStatus: "published" | "reopened") {
  const findMany = vi.fn((query: { where: { periodStatus?: string } }) =>
    Promise.resolve(
      query.where.periodStatus === periodStatus ? [editedReport] : [],
    ),
  );
  const prisma = { report: { findMany } } as unknown as PrismaService;
  return new AnalyticsPrismaRepository(prisma);
}

describe("AnalyticsPrismaRepository reopened-period floor", () => {
  it("excludes reopened traffic-light history until re-publication", async () => {
    const reopened = await repositoryFor("reopened").trafficLightHistory(
      RANGE,
      adminSession,
    );
    const republished = await repositoryFor("published").trafficLightHistory(
      RANGE,
      adminSession,
    );

    expect(reopened).toEqual({ periods: [], rows: [] });
    expect(republished.rows[0]).toMatchObject({
      projectId: PROJECT_ID,
      projectName: "Edited",
      statuses: ["red"],
    });
  });

  it("excludes reopened lead velocity until re-publication", async () => {
    const reopened = await repositoryFor("reopened").leadVelocity(
      RANGE,
      adminSession,
    );
    const republished = await repositoryFor("published").leadVelocity(
      RANGE,
      adminSession,
    );

    expect(reopened).toEqual([]);
    expect(republished[0]).toMatchObject({
      periodLabel: PERIOD,
      leads: [{ leadId: LEAD_ID }],
    });
  });

  it("excludes a reopened period comparison side until re-publication", async () => {
    const input = { periodA: PERIOD, periodB: "2026-04-28" };
    const reopened = await repositoryFor("reopened").periodComparison(
      input,
      adminSession,
    );
    const republished = await repositoryFor("published").periodComparison(
      input,
      adminSession,
    );

    expect(reopened.rows).toEqual([]);
    expect(republished.rows[0]).toMatchObject({
      projectId: PROJECT_ID,
      statusA: "red",
    });
  });
});

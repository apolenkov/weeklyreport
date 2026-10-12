import { describe, expect, it } from "vitest";

import { buildAssembledReportFromPrismaRow } from "./published-report-snapshot.js";
import { reportSectionFullInclude } from "./report-sections.include.js";
import { mapPrismaToReportSection } from "./report-sections.mappers.js";

// TASK-145.61: the shared include decides the size of every report-section
// join; whole Project/Stage rows were loaded although the mapper reads a few
// columns only.
describe("reportSectionFullInclude", () => {
  it("selects status columns without joining Project or Stage rows", () => {
    expect(reportSectionFullInclude.projectStatuses).toEqual({
      select: { projectId: true, status: true, updatedAt: true },
    });
    expect(reportSectionFullInclude.stageStatuses).toEqual({
      select: {
        projectId: true,
        stageId: true,
        status: true,
        updatedAt: true,
      },
    });
  });

  it("selects only mapper-read columns of the author's stage assignments", () => {
    const { stageAssignments } = reportSectionFullInclude.author.select;
    expect(stageAssignments).not.toHaveProperty("include");
    expect(stageAssignments.select.stage).toEqual({
      select: { name: true, sortOrder: true },
    });
    expect(stageAssignments.select.project.select).not.toHaveProperty(
      "createdAt",
    );
  });
});

describe("report-section status read projection", () => {
  it("keeps statuses bound to business identities when relation rows arrive in reverse order", () => {
    const id = (suffix: number) =>
      `10000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;
    const assignment = (suffix: number, name: string) => ({
      projectId: id(suffix),
      stageId: id(suffix + 10),
      stage: { name: "Development", sortOrder: 1 },
      project: {
        id: id(suffix),
        name,
        archived: false,
        stageAssignments: [
          {
            stageId: id(suffix + 10),
            stage: { name: "Development", sortOrder: 1 },
          },
        ],
        groupProducts: [],
      },
    });
    const row = {
      id: id(1),
      reportId: id(2),
      authorId: id(3),
      version: 1,
      status: "submitted",
      submittedAt: null,
      late: false,
      author: {
        name: "Synthetic Lead",
        role: "lead",
        reportingGroupId: null,
        stageAssignments: [assignment(4, "Alpha"), assignment(5, "Zulu")],
      },
      items: [],
      risks: [],
      decisions: [],
      activityStatuses: [],
      sectionReviews: [],
      itemOutcomeEvents: [],
      projectStatuses: [
        { projectId: id(4), status: "red" },
        { projectId: id(5), status: "green" },
      ],
      stageStatuses: [
        { projectId: id(4), stageId: id(14), status: "red" },
        { projectId: id(5), stageId: id(15), status: "green" },
      ],
    };
    type Row = Parameters<typeof mapPrismaToReportSection>[0];
    const forward = mapPrismaToReportSection(row as unknown as Row);
    const reverse = mapPrismaToReportSection({
      ...row,
      projectStatuses: row.projectStatuses.toReversed(),
      stageStatuses: row.stageStatuses.toReversed(),
    } as unknown as Row);

    expect(forward.projects).toMatchObject([
      {
        projectId: id(4),
        trafficLight: "red",
        ownedStages: [{ status: "red" }],
      },
      {
        projectId: id(5),
        trafficLight: "green",
        ownedStages: [{ status: "green" }],
      },
    ]);
    expect(reverse).toEqual(forward);
  });
});

describe("deterministic section relation ordering", () => {
  it("retains name priority and resolves activity/product name ties by identity in live and frozen projections", () => {
    const id = (suffix: number) =>
      `10000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;
    const activity = (suffix: number, name: string) => ({
      activityId: id(suffix),
      status: "green",
      note: null,
      titleOverride: null,
      activity: {
        name,
        jiraAccounts: [],
        activityProducts: [
          { product: { id: id(8), name: "Same Product" } },
          { product: { id: id(9), name: "Alpha Product" } },
          { product: { id: id(7), name: "Same Product" } },
        ],
      },
    });
    const row = {
      id: id(1),
      reportId: id(2),
      authorId: id(3),
      version: 1,
      status: "submitted",
      submittedAt: null,
      late: false,
      author: {
        id: id(3),
        name: "Synthetic Lead",
        role: "lead",
        reportingGroupId: id(10),
        reportingGroup: { id: id(10), name: "Synthetic Group" },
        stageAssignments: [],
      },
      items: [],
      risks: [],
      decisions: [],
      sectionReviews: [],
      itemOutcomeEvents: [],
      projectStatuses: [],
      stageStatuses: [],
      activityStatuses: [
        activity(5, "Same Activity"),
        activity(6, "Alpha Activity"),
        activity(4, "Same Activity"),
      ],
    };
    const reverse = {
      ...row,
      activityStatuses: row.activityStatuses.toReversed().map((status) => ({
        ...status,
        activity: {
          ...status.activity,
          activityProducts: status.activity.activityProducts.toReversed(),
        },
      })),
    };
    type Row = Parameters<typeof mapPrismaToReportSection>[0];
    const forward = mapPrismaToReportSection(row as unknown as Row);
    const backward = mapPrismaToReportSection(reverse as unknown as Row);
    expect(forward.activities.map(({ activityId }) => activityId)).toEqual([
      id(6),
      id(4),
      id(5),
    ]);
    expect(
      forward.activities[0]?.linkedProducts.map(({ productId }) => productId),
    ).toEqual([id(9), id(7), id(8)]);
    expect(backward).toEqual(forward);

    const report = (section: unknown) => ({
      id: id(2),
      periodStart: new Date("2026-09-21T00:00:00Z"),
      periodEnd: new Date("2026-09-27T00:00:00Z"),
      deadline: new Date("2026-09-28T00:00:00Z"),
      status: "published",
      publishedAt: new Date("2026-09-29T00:00:00Z"),
      publishedById: id(11),
      publishedBy: { name: "Head" },
      sections: [section],
    });
    type SnapshotRow = Parameters<typeof buildAssembledReportFromPrismaRow>[0];
    const frozenForward = buildAssembledReportFromPrismaRow(
      report(row) as unknown as SnapshotRow,
    );
    const frozenBackward = buildAssembledReportFromPrismaRow(
      report(reverse) as unknown as SnapshotRow,
    );
    expect(frozenForward.sections[0]?.activities).toEqual(forward.activities);
    expect(frozenBackward).toEqual(frozenForward);
  });

  it("requests chronological review rows with reviewer identity only breaking timestamp ties", () => {
    expect(reportSectionFullInclude.sectionReviews).toMatchObject({
      orderBy: [{ createdAt: "asc" }, { reviewerId: "asc" }],
    });
  });
});

import { describe, expect, it } from "vitest";

import { toCompleteSectionRow } from "./mappers/report-sections.complete-projection.js";
import {
  mapPrismaToAuthorReportSection,
  mapPrismaToReportSection,
} from "./report-sections.mappers.js";

type Row = Parameters<typeof mapPrismaToReportSection>[0];

const id = (suffix: number) =>
  `10000000-0000-4000-8000-${suffix.toString().padStart(12, "0")}`;

const OWNED = id(4);
const REFERENCED_BY_COMPLETE = id(5);
const REFERENCED_BY_INCOMPLETE = id(6);
const ACTIVITY = id(7);
const STAGE = "Development";

const risk = (
  suffix: number,
  parent: { projectId?: string; projectName?: string; activityId?: string },
  details: { impact: string | null; mitigation: string | null },
) => ({
  id: id(suffix),
  stableId: id(suffix + 100),
  projectId: parent.projectId ?? null,
  activityId: parent.activityId ?? null,
  project: parent.projectName ? { name: parent.projectName } : null,
  risk: `Risk ${suffix}`,
  severity: "blocked",
  stageNames: parent.projectId ? [STAGE] : [],
  recordComments: [],
  ...details,
});

const decision = (
  suffix: number,
  productId: string,
  projectName: string,
  impact: string | null,
) => ({
  id: id(suffix),
  stableId: id(suffix + 100),
  text: `Decision ${suffix}`,
  owner: "Owner",
  deadline: null,
  impact,
  resolvedAt: null,
  stageNames: [STAGE],
  productId,
  activityId: null,
  project: { name: projectName },
  recordComments: [],
});

const COMPLETE = { impact: "Delivery slips", mitigation: "Escalate" };
const NO_MITIGATION = { impact: "Delivery slips", mitigation: null };
const NO_DETAILS = { impact: null, mitigation: null };

const section = (records: {
  readonly risks: readonly unknown[];
  readonly decisions?: readonly unknown[];
  readonly status?: string;
}) =>
  ({
    id: id(1),
    reportId: id(2),
    authorId: id(3),
    version: 1,
    status: records.status ?? "draft",
    submittedAt: null,
    late: false,
    author: {
      name: "Synthetic Lead",
      role: "lead",
      reportingGroupId: null,
      stageAssignments: [
        {
          projectId: OWNED,
          stageId: id(14),
          stage: { name: STAGE, sortOrder: 1 },
          project: {
            id: OWNED,
            name: "Owned",
            archived: false,
            stageAssignments: [
              { stageId: id(14), stage: { name: STAGE, sortOrder: 1 } },
            ],
            groupProducts: [],
          },
        },
      ],
    },
    items: [],
    risks: records.risks,
    decisions: records.decisions ?? [],
    activityStatuses: [
      {
        activityId: ACTIVITY,
        status: "green",
        note: null,
        titleOverride: null,
        activity: { name: "Hiring", jiraAccounts: [], activityProducts: [] },
      },
    ],
    sectionReviews: [],
    itemOutcomeEvents: [],
    projectStatuses: [{ projectId: OWNED, status: "green" }],
    stageStatuses: [{ projectId: OWNED, stageId: id(14), status: "green" }],
  }) as unknown as Row;

const MIXED = section({
  risks: [
    risk(20, { projectId: OWNED, projectName: "Owned" }, NO_MITIGATION),
    risk(21, { activityId: ACTIVITY }, NO_DETAILS),
    risk(
      22,
      { projectId: REFERENCED_BY_INCOMPLETE, projectName: "Private" },
      NO_DETAILS,
    ),
  ],
  decisions: [
    decision(30, REFERENCED_BY_COMPLETE, "Shared", "Scope moves"),
    decision(31, OWNED, "Owned", null),
  ],
});

describe("complete section projection", () => {
  it("removes incomplete risks and decisions and keeps the complete ones", () => {
    const read = mapPrismaToReportSection(MIXED);

    expect(read.risks).toEqual([]);
    expect(read.decisions.map((entry) => entry.id)).toEqual([id(30)]);
  });

  it("does not let an incomplete blocked risk floor a Product or an Activity", () => {
    const read = mapPrismaToReportSection(MIXED);

    expect(read.projects).toMatchObject([
      { projectId: OWNED, trafficLight: "green" },
    ]);
    expect(read.activities).toMatchObject([
      { activityId: ACTIVITY, derivedStatus: "green", alarmFloor: null },
    ]);
  });

  it("names a Product referenced by a complete record only", () => {
    const read = mapPrismaToReportSection(MIXED);

    expect(read.referencedProjects).toEqual([
      { projectId: REFERENCED_BY_COMPLETE, projectName: "Shared" },
    ]);
  });

  it("keeps a complete blocked risk flooring an unsubmitted section", () => {
    const read = mapPrismaToReportSection(
      section({
        risks: [
          risk(20, { projectId: OWNED, projectName: "Owned" }, COMPLETE),
          risk(21, { activityId: ACTIVITY }, COMPLETE),
        ],
      }),
    );

    expect(read.risks).toHaveLength(2);
    expect(read.projects).toMatchObject([{ trafficLight: "red" }]);
    expect(read.activities).toMatchObject([{ alarmFloor: "red" }]);
  });

  it("leaves the input row untouched", () => {
    const complete = toCompleteSectionRow(MIXED);

    expect(complete.risks).toEqual([]);
    expect(MIXED.risks).toHaveLength(3);
    expect(MIXED.decisions).toHaveLength(2);
  });
});

describe("author section read", () => {
  it("shows the author their incomplete records with null details", () => {
    const own = mapPrismaToAuthorReportSection(MIXED);

    expect(own.risks).toMatchObject([
      { id: id(20), impact: "Delivery slips", mitigation: null },
      { id: id(21), impact: null, mitigation: null },
      { id: id(22), impact: null, mitigation: null },
    ]);
    expect(own.decisions).toMatchObject([
      { id: id(30), impact: "Scope moves" },
      { id: id(31), impact: null },
    ]);
  });

  it("names the Product of an own incomplete record", () => {
    const own = mapPrismaToAuthorReportSection(MIXED);

    expect(own.referencedProjects).toEqual([
      { projectId: REFERENCED_BY_INCOMPLETE, projectName: "Private" },
      { projectId: REFERENCED_BY_COMPLETE, projectName: "Shared" },
    ]);
  });

  it("does not floor the author's own statuses with an incomplete risk", () => {
    const own = mapPrismaToAuthorReportSection(MIXED);

    expect(own.projects).toMatchObject([{ trafficLight: "green" }]);
    expect(own.activities).toMatchObject([
      { derivedStatus: "green", alarmFloor: null },
    ]);
  });
});

// Pins saveSection row-builders (stableId omit, XOR nulling, empty-array guards).
import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  assertPersistableDecisionParents,
  toActivityStatusRows,
  toDecisionRows,
  toItemRows,
  toProjectStatusRows,
  toRiskRows,
  toStageStatusRows,
} from "./save-section.derive";

const SECTION_ID = "ssssssss-ssss-4sss-8sss-ssssssssssss";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ACTIVITY = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STAGE = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

// A minimally-populated read model; each test overrides only what it exercises.
function section(
  over: Partial<ReportSectionReadModel>,
): ReportSectionReadModel {
  return {
    reportSectionId: SECTION_ID,
    reportId: "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr",
    authorId: "uuuuuuuu-uuuu-4uuu-8uuu-uuuuuuuuuuuu",
    authorName: "Lead",
    authorRole: "lead",
    version: 1,
    status: "draft",
    submittedAt: null,
    late: false,
    projects: [],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    activities: [],
    reviews: [],
    ...over,
  };
}

describe("toItemRows", () => {
  it("omits stableId (undefined) for a brand-new record, keeps it when supplied", () => {
    const rows = toItemRows(
      section({
        items: [
          {
            id: "new",
            stableId: undefined,
            projectId: PROJECT,
            activityId: null,
            type: "current",
            text: "New",
            tag: "feature",
            workflowStatus: "in_progress",
            carriedOver: false,
            priorityRank: null,
            pausedReason: null,
            stageNames: ["Development"],
            comments: [],
          },
          {
            id: "old",
            stableId: "stable-1",
            projectId: PROJECT,
            activityId: null,
            type: "current",
            text: "Old",
            tag: "feature",
            workflowStatus: "in_progress",
            carriedOver: true,
            priorityRank: 2,
            pausedReason: "waiting",
            stageNames: ["Development"],
            comments: [],
          },
        ],
      }),
      SECTION_ID,
    );

    // undefined stableId → Prisma mints default; supplied value is preserved.
    expect(rows[0]?.stableId).toBeUndefined();
    expect(rows[1]?.stableId).toBe("stable-1");
    expect(rows[0]?.priorityRank).toBeNull();
    expect(rows[0]?.pausedReason).toBeNull();
    expect(rows[0]?.stageNames).toEqual(["Development"]);
    expect(rows[1]?.stageNames).toEqual(["Development"]);
    expect(rows[0]?.reportSectionId).toBe(SECTION_ID);
  });

  it("XOR-nulls projectId/activityId from the read-model parent", () => {
    const rows = toItemRows(
      section({
        items: [
          {
            id: "act",
            stableId: "s",
            projectId: null,
            activityId: ACTIVITY,
            type: "current",
            text: "Activity item",
            tag: "chore",
            workflowStatus: "in_progress",
            carriedOver: false,
            priorityRank: null,
            pausedReason: null,
            stageNames: [],
            comments: [],
          },
        ],
      }),
      SECTION_ID,
    );

    expect(rows[0]?.projectId).toBeNull();
    expect(rows[0]?.activityId).toBe(ACTIVITY);
  });
});

describe("assertPersistableDecisionParents + toDecisionRows", () => {
  type Decision = ReportSectionReadModel["decisions"][number];
  const decision = (over: Partial<Decision>): Decision => ({
    id: "d",
    stableId: "s",
    text: "Decide",
    owner: "Lead",
    deadline: null,
    impact: "Impact",
    resolvedAt: null,
    stageNames: ["Development"],
    productId: undefined,
    activityId: undefined,
    comments: [],
    ...over,
  });

  it("accepts exactly-one-parent decisions (product-only and activity-only)", () => {
    expect(() =>
      assertPersistableDecisionParents([
        decision({ productId: PROJECT }),
        decision({ activityId: ACTIVITY }),
      ]),
    ).not.toThrow();
  });

  it("rejects a decision carrying BOTH parents loudly (XOR invariant)", () => {
    expect(() =>
      assertPersistableDecisionParents([
        decision({ productId: PROJECT, activityId: ACTIVITY }),
      ]),
    ).toThrow(/exactly one parent/);
  });

  it("rejects a decision with NEITHER parent loudly (XOR invariant)", () => {
    expect(() => assertPersistableDecisionParents([decision({})])).toThrow(
      /exactly one parent/,
    );
  });

  it("maps XOR parent to null for the missing side", () => {
    const rows = toDecisionRows(
      [decision({ activityId: ACTIVITY, stageNames: [] })],
      SECTION_ID,
    );
    expect(rows[0]?.productId).toBeNull();
    expect(rows[0]?.activityId).toBe(ACTIVITY);
    expect(rows[0]?.stageNames).toEqual([]);
  });
});

describe("empty collections yield empty arrays", () => {
  it("every row builder returns [] for an empty section", () => {
    const s = section({});
    expect(toProjectStatusRows(s, SECTION_ID)).toEqual([]);
    expect(toStageStatusRows(s, SECTION_ID)).toEqual([]);
    expect(toActivityStatusRows(s, SECTION_ID)).toEqual([]);
    expect(toItemRows(s, SECTION_ID)).toEqual([]);
    expect(toRiskRows(s, SECTION_ID)).toEqual([]);
    expect(toDecisionRows([], SECTION_ID)).toEqual([]);
  });
});

describe("toProjectStatusRows / toStageStatusRows", () => {
  it("maps project status and flattens owned-stage statuses, nulling absent status", () => {
    const s = section({
      projects: [
        {
          projectId: PROJECT,
          projectName: "Alpha",
          trafficLight: "green",
          ownedStages: [
            {
              stageId: STAGE,
              stageName: "Development",
              sortOrder: 4,
              status: null,
            },
          ],
          stageSet: [],
          ownerGroupId: null,
        },
      ],
    });

    expect(toProjectStatusRows(s, SECTION_ID)).toEqual([
      { reportSectionId: SECTION_ID, projectId: PROJECT, status: "green" },
    ]);
    expect(toStageStatusRows(s, SECTION_ID)).toEqual([
      {
        reportSectionId: SECTION_ID,
        projectId: PROJECT,
        stageId: STAGE,
        status: null,
      },
    ]);
  });
});

describe("toActivityStatusRows", () => {
  it("persists the weekly title override and nulls an absent one", () => {
    const s = section({
      activities: [
        {
          activityId: ACTIVITY,
          activityName: "Catalogue duty",
          titleOverride: "Weekly duty",
          status: "green",
          note: "Weekly description",
          jiraAccounts: [],
          linkedProducts: [],
          derivedStatus: null,
          alarmFloor: null,
        },
        {
          activityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          activityName: "No override",
          status: "red",
          jiraAccounts: [],
          linkedProducts: [],
          derivedStatus: null,
          alarmFloor: null,
        },
      ],
    });

    const rows = toActivityStatusRows(s, SECTION_ID);
    expect(rows[0]).toEqual({
      reportSectionId: SECTION_ID,
      activityId: ACTIVITY,
      status: "green",
      titleOverride: "Weekly duty",
      note: "Weekly description",
    });
    expect(rows[1]?.titleOverride).toBeNull();
  });
});

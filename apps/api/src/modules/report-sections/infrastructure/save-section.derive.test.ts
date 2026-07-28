// Pins saveSection row-builders (stableId omit, XOR nulling, empty-array guards).
import type { ReportSectionReadModel } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import {
  isPersistableDecision,
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
            stageNames: undefined,
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
    expect(rows[0]?.stageNames).toEqual([]);
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
            stageNames: undefined,
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

describe("isPersistableDecision + toDecisionRows", () => {
  type Decision = ReportSectionReadModel["decisions"][number];
  const decision = (over: Partial<Decision>): Decision => ({
    id: "d",
    stableId: "s",
    text: "Decide",
    owner: "Lead",
    deadline: null,
    impact: "Impact",
    resolvedAt: null,
    stageNames: undefined,
    productId: undefined,
    activityId: undefined,
    comments: [],
    ...over,
  });

  it("drops a decision with both productId and activityId null/undefined", () => {
    expect(isPersistableDecision(decision({}))).toBe(false);
    expect(isPersistableDecision(decision({ productId: PROJECT }))).toBe(true);
    expect(isPersistableDecision(decision({ activityId: ACTIVITY }))).toBe(
      true,
    );
  });

  it("maps XOR parent to null for the missing side", () => {
    const rows = toDecisionRows(
      [decision({ activityId: ACTIVITY })],
      SECTION_ID,
    );
    expect(rows[0]?.productId).toBeNull();
    expect(rows[0]?.activityId).toBe(ACTIVITY);
    expect(rows[0]?.stageNames).toEqual([]);
  });
});

describe("empty collections yield empty arrays", () => {
  it("every builder returns [] for an empty section (length>0 guard stays valid)", () => {
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

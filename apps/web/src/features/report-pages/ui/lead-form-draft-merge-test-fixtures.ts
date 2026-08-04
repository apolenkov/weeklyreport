import type { ReportSectionReadModel } from "@customreport/shared";

import {
  type ActivityFixture,
  makeReportSectionFixture,
  type ProjectFixture,
} from "../../../test-utils/report-section-fixtures";

const REPORT_SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";

export const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
export const ACTIVITY_ID = "55555555-5555-4555-8555-555555555555";
export const CURRENT_ITEM_ID = "66666666-6666-4666-8666-666666666666";
export const ACTIVITY_ITEM_ID = "77777777-7777-4777-8777-777777777777";
export const RISK_ID = "88888888-8888-4888-8888-888888888888";
export const DECISION_ID = "99999999-9999-4999-8999-999999999999";

// Each collection is built per call so a test mutating one fixture cannot
// leak into the next.
function makeProjects(): ProjectFixture[] {
  return [
    {
      projectId: PROJECT_ID,
      projectName: "Test Product",
      trafficLight: "green",
      ownedStages: [
        {
          stageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          stageName: "Development",
          sortOrder: 1,
          status: "green",
        },
        {
          stageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          stageName: "Testing",
          sortOrder: 2,
          status: "green",
        },
      ],
    },
  ];
}

function makeItems(): ReportSectionReadModel["items"] {
  return [
    {
      id: CURRENT_ITEM_ID,
      stableId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      projectId: PROJECT_ID,
      activityId: null,
      type: "current",
      text: "Current product item",
      tag: "general",
      workflowStatus: "paused",
      carriedOver: false,
      stageNames: ["Development"],
      priorityRank: 2,
      pausedReason: "Waiting on vendor",
    },
    {
      id: ACTIVITY_ITEM_ID,
      stableId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      projectId: null,
      activityId: ACTIVITY_ID,
      type: "current",
      text: "Current activity item",
      tag: "general",
      workflowStatus: "in_progress",
      carriedOver: false,
      stageNames: [],
      priorityRank: null,
      pausedReason: null,
    },
  ];
}

function makeRisks(): ReportSectionReadModel["risks"] {
  return [
    {
      id: RISK_ID,
      stableId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      projectId: PROJECT_ID,
      activityId: null,
      risk: "Existing risk",
      impact: "Existing impact",
      mitigation: "Existing mitigation",
      severity: "at-risk",
      stageNames: ["Development"],
    },
  ];
}

function makeDecisions(): ReportSectionReadModel["decisions"] {
  return [
    {
      id: DECISION_ID,
      stableId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      productId: PROJECT_ID,
      activityId: null,
      text: "Existing decision",
      owner: "Owner",
      impact: "Impact",
      deadline: null,
      resolvedAt: new Date("2026-06-01T00:00:00Z"),
      stageNames: ["Development"],
    },
  ];
}

function makeActivities(): ActivityFixture[] {
  return [
    {
      activityId: ACTIVITY_ID,
      activityName: "Ops rotation",
      status: "green",
      linkedProducts: [],
      derivedStatus: "green",
    },
  ];
}

export function makeDraftMergeSection(): ReportSectionReadModel {
  return makeReportSectionFixture({
    reportSectionId: REPORT_SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Test Lead",
    projects: makeProjects(),
    items: makeItems(),
    risks: makeRisks(),
    decisions: makeDecisions(),
    activities: makeActivities(),
  });
}

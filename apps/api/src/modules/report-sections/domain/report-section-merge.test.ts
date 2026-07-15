import {
  type DraftSavePayload,
  type ReportSectionReadModel,
  riskCoversStage,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { mergeSection } from "./report-section-merge";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "44444444-4444-4444-8444-444444444444";
const STAGE_ID = "55555555-5555-4555-8555-555555555555";
const RISK_ID = "66666666-6666-4666-8666-666666666666";

const section: ReportSectionReadModel = {
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: AUTHOR_ID,
  authorName: "Alice Lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  projects: [
    {
      projectId: PROJECT_ID,
      projectName: "CRM Portal",
      trafficLight: null,
      ownedStages: [
        {
          stageId: STAGE_ID,
          stageName: "Development",
          sortOrder: 0,
          status: null,
        },
      ],
    },
  ],
  items: [],
  risks: [],
  decisions: [],
  activities: [],
};

const baseInput: DraftSavePayload = {
  reportSectionId: SECTION_ID,
  version: 1,
  status: "draft",
  projectStatuses: [],
  stageStatuses: [],
  activityStatuses: [],
  items: [],
  risks: [],
  decisions: [],
};

describe("mergeSection traffic-light aggregation", () => {
  it("aggregates a Dev risk-derived red status for Development", () => {
    const risk = {
      id: RISK_ID,
      projectId: PROJECT_ID,
      risk: "Release blocker",
      impact: "High",
      mitigation: "Fix before release",
      severity: "blocked" as const,
      stageIds: ["Dev"],
    };
    const riskDerivedStatus = riskCoversStage(risk, "Development")
      ? ("red" as const)
      : null;

    const merged = mergeSection(
      section,
      {
        ...baseInput,
        projectStatuses: [{ projectId: PROJECT_ID, status: "green" }],
        stageStatuses: [
          {
            projectId: PROJECT_ID,
            stageId: STAGE_ID,
            status: riskDerivedStatus,
          },
        ],
        risks: [risk],
      },
      "draft",
    );

    expect(riskDerivedStatus).toBe("red");
    expect(merged.projects[0]?.trafficLight).toBe("red");
  });

  it("retains the project-status fallback when no stage status exists", () => {
    const merged = mergeSection(
      section,
      {
        ...baseInput,
        projectStatuses: [{ projectId: PROJECT_ID, status: "yellow" }],
      },
      "draft",
    );

    expect(merged.projects[0]?.trafficLight).toBe("yellow");
  });
});

import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { buildEscalationsFromReadSections } from "./published-report-snapshot";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const OWNED_PRODUCT = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const REFERENCED_PRODUCT = "eeb16c80-2f85-48a0-b838-d8096981ddba";

function makeSection(
  overrides: Partial<ReportSectionReadModel> = {},
): ReportSectionReadModel {
  return reportSectionReadModelSchema.parse({
    reportSectionId: SECTION_ID,
    reportId: REPORT_ID,
    authorId: AUTHOR_ID,
    authorName: "Alice Lead",
    status: "submitted",
    submittedAt: null,
    projects: [
      {
        projectId: OWNED_PRODUCT,
        projectName: "CRM Portal",
        trafficLight: "green",
        ownedStages: [],
      },
    ],
    referencedProjects: [],
    items: [],
    risks: [],
    decisions: [],
    ...overrides,
  });
}

describe("buildEscalationsFromReadSections", () => {
  it("resolves a single stage name for a blocked item", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        items: [
          {
            id: "5b2fe575-86c3-422e-b7ed-5fe858cab7f7",
            projectId: OWNED_PRODUCT,
            type: "current",
            text: "ETL pipeline blocked",
            tag: "infra",
            workflowStatus: "blocked",
            carriedOver: false,
            completed: null,
            priorityRank: null,
            stageIds: ["Development"],
          },
        ],
      }),
    ]);

    expect(escalations).toHaveLength(1);
    expect(escalations[0]).toMatchObject({
      type: "blocked",
      productName: "CRM Portal",
      stageName: "Development",
    });
  });

  it("joins multiple stage names for a multi-stage risk", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        risks: [
          {
            id: "0e4f5947-bab4-4e24-a9f3-5cd3d0b1fb42",
            projectId: OWNED_PRODUCT,
            risk: "Cross-stage regression",
            impact: "High",
            mitigation: "Backport",
            severity: "at-risk",
            stageIds: ["Development", "Testing"],
          },
        ],
      }),
    ]);

    const risk = escalations.find((e) => e.type === "unresolved_risk");
    expect(risk?.stageName).toBe("Development, Testing");
  });

  it("returns a null stage for a legacy stage-less row", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        items: [
          {
            id: "f57e03c5-ed65-4b82-8c58-74cb6f1931de",
            projectId: OWNED_PRODUCT,
            type: "current",
            text: "Legacy blocker",
            tag: "infra",
            workflowStatus: "blocked",
            carriedOver: false,
            completed: null,
            priorityRank: null,
            stageIds: undefined,
          },
        ],
      }),
    ]);

    expect(escalations[0]?.stageName).toBeNull();
  });

  it("resolves a product name referenced but not owned (never 'Unknown')", () => {
    const escalations = buildEscalationsFromReadSections([
      makeSection({
        referencedProjects: [
          { projectId: REFERENCED_PRODUCT, projectName: "Shared Platform" },
        ],
        risks: [
          {
            id: "aa514484-bbd6-4583-926f-dc20e922421b",
            projectId: REFERENCED_PRODUCT,
            risk: "Dependency risk",
            impact: "Medium",
            mitigation: "Coordinate",
            severity: "at-risk",
            stageIds: ["Discovery"],
          },
        ],
      }),
    ]);

    const risk = escalations.find((e) => e.type === "unresolved_risk");
    expect(risk?.productName).toBe("Shared Platform");
    expect(risk?.productName).not.toBe("Unknown");
  });
});

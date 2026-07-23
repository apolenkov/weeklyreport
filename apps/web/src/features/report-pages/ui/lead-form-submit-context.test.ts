import { describe, expect, it } from "vitest";

import type { DraftSaveContent } from "../../../hooks/use-lead-form-autosave";
import type { Product } from "../../report-sections";
import { buildSubmitStages } from "./lead-form-submit-context";

const DRAFT: DraftSaveContent = {
  reportSectionId: "section-1",
  status: "draft",
  projectStatuses: [],
  activityStatuses: [],
  stageStatuses: [
    { projectId: "product-1", stageId: "stage-development", status: "green" },
    { projectId: "product-1", stageId: "stage-testing", status: "yellow" },
  ],
  items: [],
  risks: [],
  decisions: [],
};

const PRODUCTS: Product[] = [
  {
    id: "product-1",
    name: "Portal",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Discovery",
        status: "on-track",
        ownership: "locked",
        assignee: "Other Lead",
      },
      {
        stageName: "Development",
        status: "on-track",
        ownership: "mine",
        assignee: "Test Lead",
      },
      {
        stageName: "Testing",
        status: "at-risk",
        ownership: "mine",
        assignee: "Test Lead",
      },
    ],
  },
];

describe("buildSubmitStages", () => {
  it("resolves draft stage labels from owned stages without locked-stage drift", () => {
    expect(buildSubmitStages(DRAFT, PRODUCTS)).toEqual([
      {
        projectId: "product-1",
        stageId: "stage-development",
        name: "Development",
      },
      {
        projectId: "product-1",
        stageId: "stage-testing",
        name: "Testing",
      },
    ]);
  });
});

import { describe, expect, it } from "vitest";

import type { DraftSaveContent } from "../lead-section-draft-payload";
import type { Product } from "../types";
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

  it("leaves the name null when the positional owned-stage lookup misses — never the raw stage id", () => {
    const unknownProductDraft: DraftSaveContent = {
      ...DRAFT,
      stageStatuses: [
        { projectId: "product-ghost", stageId: "stage-dead", status: "green" },
      ],
    };

    expect(buildSubmitStages(unknownProductDraft, PRODUCTS)).toEqual([
      {
        projectId: "product-ghost",
        stageId: "stage-dead",
        name: null,
      },
    ]);
  });

  it("leaves the name null when the owned-stage position is out of range — never the raw stage id", () => {
    // The product EXISTS but owns only two stages; the third status for it
    // has no positional label, so the name must be null, not the stage id.
    const overIndexedDraft: DraftSaveContent = {
      ...DRAFT,
      stageStatuses: [
        { projectId: "product-1", stageId: "stage-x", status: "green" },
        { projectId: "product-1", stageId: "stage-y", status: "green" },
        { projectId: "product-1", stageId: "stage-z", status: "green" },
      ],
    };

    expect(buildSubmitStages(overIndexedDraft, PRODUCTS)).toEqual([
      { projectId: "product-1", stageId: "stage-x", name: "Development" },
      { projectId: "product-1", stageId: "stage-y", name: "Testing" },
      { projectId: "product-1", stageId: "stage-z", name: null },
    ]);
  });

  it("counts duplicate-project statuses by position within the project, not globally", () => {
    const interleavedDraft: DraftSaveContent = {
      ...DRAFT,
      stageStatuses: [
        { projectId: "product-1", stageId: "stage-dev", status: "green" },
        { projectId: "product-ghost", stageId: "stage-ghost", status: "green" },
        { projectId: "product-1", stageId: "stage-test", status: "yellow" },
      ],
    };

    // The second product-1 status is index 1 within product-1 (the ghost
    // status does not advance it), so it resolves to Testing.
    expect(buildSubmitStages(interleavedDraft, PRODUCTS)).toEqual([
      { projectId: "product-1", stageId: "stage-dev", name: "Development" },
      { projectId: "product-ghost", stageId: "stage-ghost", name: null },
      { projectId: "product-1", stageId: "stage-test", name: "Testing" },
    ]);
  });
});

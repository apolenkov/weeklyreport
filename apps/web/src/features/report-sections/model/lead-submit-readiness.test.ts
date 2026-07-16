import { describe, expect, it } from "vitest";

import type { DraftSaveContent } from "./lead-section-draft-payload";
import {
  buildLeadSubmitPayload,
  deriveLeadSubmitReadiness,
  type LeadSubmitReadinessInput,
} from "./lead-submit-readiness";
import type { Product, RiskEntry } from "./types";

const draft: DraftSaveContent = {
  reportSectionId: "section-1",
  status: "draft",
  projectStatuses: [{ projectId: "product-1", status: undefined }],
  activityStatuses: [{ activityId: "activity-1", status: null, note: null }],
  stageStatuses: [
    { projectId: "product-1", stageId: "stage-1", status: null },
    { projectId: "product-1", stageId: "stage-2", status: "red" },
  ],
  items: [],
  risks: [],
  decisions: [],
};

const products: Product[] = [
  {
    id: "product-1",
    name: "Portal",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Development",
        status: "on-track",
        ownership: "mine",
        assignee: null,
      },
    ],
  },
];

const baseInput: LeadSubmitReadinessInput = {
  draftPayload: draft,
  products,
  activities: [{ id: "activity-1", name: "Hiring" }],
  stages: [
    { projectId: "product-1", stageId: "stage-1", name: "Development" },
    { projectId: "product-1", stageId: "stage-2", name: "Testing" },
  ],
  ownRisks: [],
  autosaveState: "idle",
  submitPending: false,
};

describe("deriveLeadSubmitReadiness", () => {
  it("identifies unset statuses and every status the submit payload promotes", () => {
    const readiness = deriveLeadSubmitReadiness(baseInput);

    expect(readiness.unsetStatuses.map((item) => item.label)).toEqual([
      "Portal",
      "Hiring",
      "Portal / Development",
    ]);
    expect(readiness.willAutoPromote.map((item) => item.label)).toEqual([
      "Portal",
      "Hiring",
      "Portal / Development",
      "Portal / Testing",
    ]);
    expect(readiness.canOpenConfirmation).toBe(true);
  });

  it("names the product whose committed risk lacks a stage link", () => {
    const risk: RiskEntry = {
      id: "risk-1",
      productId: "product-1",
      productName: "Portal",
      severity: "blocked",
      text: "Release risk",
      impact: "Date slips",
      mitigation: "Reduce scope",
      stageIds: [],
    };
    const readiness = deriveLeadSubmitReadiness({
      ...baseInput,
      products: [{ ...products[0], overallStatus: "blocked" }],
      ownRisks: [risk],
      autosaveState: "error",
    });

    expect(readiness.blockingIssues).toEqual([
      {
        id: "risk-stage:product-1",
        label: "Portal: specify stages for committed risks.",
      },
    ]);
    expect(readiness.autosaveState).toBe("error");
    expect(readiness.canOpenConfirmation).toBe(false);
  });

  it("blocks an absent draft and disables confirmation while submit is pending", () => {
    const absent = deriveLeadSubmitReadiness({
      ...baseInput,
      draftPayload: null,
    });
    const pending = deriveLeadSubmitReadiness({
      ...baseInput,
      submitPending: true,
    });

    expect(absent.blockingIssues[0]?.id).toBe("missing-draft");
    expect(absent.canOpenConfirmation).toBe(false);
    expect(pending.blockingIssues).toEqual([]);
    expect(pending.canOpenConfirmation).toBe(false);
  });
});

describe("buildLeadSubmitPayload", () => {
  it("preserves the existing product, activity, and stage promotion rules", () => {
    const payload = buildLeadSubmitPayload(draft, 7);

    expect(payload.version).toBe(7);
    expect(payload.projectStatuses[0]?.status).toBe("green");
    expect(payload.activityStatuses[0]?.status).toBe("green");
    expect(payload.stageStatuses.map((status) => status.status)).toEqual([
      "green",
      "green",
    ]);
    expect(payload.confirmed).toBe(true);
  });
});

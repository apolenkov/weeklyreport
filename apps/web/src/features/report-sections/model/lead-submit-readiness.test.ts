import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
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
  it("identifies only unset statuses as submit-time promotions", () => {
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
      stageNames: [],
    };
    const readiness = deriveLeadSubmitReadiness({
      ...baseInput,
      products: [{ ...expectDefined(products[0]), overallStatus: "blocked" }],
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
  // "Risks are the single source of truth for at-risk/blocked": submit stores
  // chip-authored stage state as On Track; risk rows carry any severity floor.
  it("promotes an unset stage to green and includes it in the warning", () => {
    const payload = buildLeadSubmitPayload(draft, 7);
    const readiness = deriveLeadSubmitReadiness(baseInput);

    expect(payload.version).toBe(7);
    expect(payload.projectStatuses[0]?.status).toBe("green");
    expect(payload.activityStatuses[0]?.status).toBe("green");
    expect(payload.stageStatuses[0]?.status).toBe("green");
    expect(readiness.unsetStatuses.map((status) => status.id)).toContain(
      "stage:product-1:stage-1",
    );
    expect(payload.confirmed).toBe(true);
  });

  it("preserves explicit stage statuses while promoting only unset stages", () => {
    const payload = buildLeadSubmitPayload(
      {
        ...draft,
        stageStatuses: [
          ...(draft.stageStatuses ?? []),
          { projectId: "product-1", stageId: "stage-3", status: "yellow" },
          { projectId: "product-1", stageId: "stage-4", status: "green" },
        ],
      },
      7,
    );
    const readiness = deriveLeadSubmitReadiness(baseInput);

    expect(payload.stageStatuses.map((status) => status.status)).toEqual([
      "green",
      "red",
      "yellow",
      "green",
    ]);
    expect(readiness.unsetStatuses.map((status) => status.id)).not.toContain(
      "stage:product-1:stage-2",
    );
  });
});

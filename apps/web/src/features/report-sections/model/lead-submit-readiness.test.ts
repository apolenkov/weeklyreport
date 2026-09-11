import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import type { DraftSaveContent } from "./lead-section-draft-payload";
import {
  buildLeadSubmitPayload,
  deriveLeadSubmitReadiness,
  type LeadSubmitReadinessInput,
} from "./lead-submit-readiness";
import type { Product, RiskEntry } from "./types";

const SECTION_ID = "10000000-0000-4000-8000-000000000001";
const PRODUCT_ID = "10000000-0000-4000-8000-000000000002";
const ACTIVITY_ID = "10000000-0000-4000-8000-000000000003";
const STAGE_ONE_ID = "10000000-0000-4000-8000-000000000004";
const STAGE_TWO_ID = "10000000-0000-4000-8000-000000000005";
const STAGE_THREE_ID = "10000000-0000-4000-8000-000000000006";
const STAGE_FOUR_ID = "10000000-0000-4000-8000-000000000007";

const draft: DraftSaveContent = {
  reportSectionId: SECTION_ID,
  status: "draft",
  projectStatuses: [{ projectId: PRODUCT_ID, status: undefined }],
  activityStatuses: [{ activityId: ACTIVITY_ID, status: null, note: null }],
  stageStatuses: [
    { projectId: PRODUCT_ID, stageId: STAGE_ONE_ID, status: null },
    { projectId: PRODUCT_ID, stageId: STAGE_TWO_ID, status: "red" },
  ],
  items: [
    {
      projectId: PRODUCT_ID,
      activityId: null,
      type: "current",
      text: "Implement the report",
      tag: "delivery",
      nextStepText: null,
      workflowStatus: "in_progress",
      carriedOver: false,
      stageNames: ["Development"],
      priorityRank: 1,
      pausedReason: null,
    },
  ],
  risks: [],
  decisions: [],
};

const products: Product[] = [
  {
    id: PRODUCT_ID,
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
  draftSection: makeReportSectionFixture({
    reportSectionId: SECTION_ID,
    version: 7,
    projects: [
      {
        projectId: PRODUCT_ID,
        projectName: "Portal",
        trafficLight: null,
      },
    ],
  }),
  draftPayload: draft,
  products,
  activities: [{ id: ACTIVITY_ID, name: "Hiring" }],
  stages: [
    { projectId: PRODUCT_ID, stageId: STAGE_ONE_ID, name: "Development" },
    { projectId: PRODUCT_ID, stageId: STAGE_TWO_ID, name: "Testing" },
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
      productId: PRODUCT_ID,
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
        id: `risk-stage:${PRODUCT_ID}`,
        label: "Portal: specify stages for committed risks.",
      },
    ]);
    expect(readiness.autosaveState).toBe("error");
    expect(readiness.canOpenConfirmation).toBe(false);
  });

  it("blocks confirmation when a section project has no Current Week item", () => {
    const readiness = deriveLeadSubmitReadiness({
      ...baseInput,
      draftPayload: {
        ...draft,
        items: draft.items.map((item) => ({
          ...item,
          type: "next",
          workflowStatus: "planned",
        })),
      },
    });

    expect(readiness.blockingIssues).toEqual([
      {
        id: "submit-validation:MISSING_CURRENT_ITEM:0",
        label: "Project Portal needs at least one Current Week item.",
      },
    ]);
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
  // Submit preserves explicit red/yellow/green stage choices and promotes only
  // unset statuses to green; risks apply their separate severity floor.
  it("promotes an unset stage to green and includes it in the warning", () => {
    const payload = buildLeadSubmitPayload(draft, 7);
    const readiness = deriveLeadSubmitReadiness(baseInput);

    expect(payload.version).toBe(7);
    expect(payload.projectStatuses[0]?.status).toBe("green");
    expect(payload.activityStatuses[0]?.status).toBe("green");
    expect(payload.stageStatuses[0]?.status).toBe("green");
    expect(readiness.unsetStatuses.map((status) => status.id)).toContain(
      `stage:${PRODUCT_ID}:${STAGE_ONE_ID}`,
    );
    expect(payload.confirmed).toBe(true);
  });

  it("preserves explicit stage statuses while promoting only unset stages", () => {
    const payload = buildLeadSubmitPayload(
      {
        ...draft,
        stageStatuses: [
          ...(draft.stageStatuses ?? []),
          { projectId: PRODUCT_ID, stageId: STAGE_THREE_ID, status: "yellow" },
          { projectId: PRODUCT_ID, stageId: STAGE_FOUR_ID, status: "green" },
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
      `stage:${PRODUCT_ID}:${STAGE_TWO_ID}`,
    );
  });
});

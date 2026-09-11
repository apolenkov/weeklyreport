import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../../test-utils/report-section-fixtures";
import type { DraftSaveContent } from "../lead-section-draft-payload";
import type { Product } from "../types";
import {
  buildLeadSubmitReadiness,
  buildSubmitStages,
} from "./lead-form-submit-context";

const SECTION_ID = "20000000-0000-4000-8000-000000000001";
const PRODUCT_ID = "20000000-0000-4000-8000-000000000002";
const STAGE_DEVELOPMENT_ID = "20000000-0000-4000-8000-000000000003";
const STAGE_TESTING_ID = "20000000-0000-4000-8000-000000000004";

const DRAFT: DraftSaveContent = {
  reportSectionId: SECTION_ID,
  status: "draft",
  projectStatuses: [],
  activityStatuses: [],
  stageStatuses: [
    {
      projectId: PRODUCT_ID,
      stageId: STAGE_DEVELOPMENT_ID,
      status: "green",
    },
    { projectId: PRODUCT_ID, stageId: STAGE_TESTING_ID, status: "yellow" },
  ],
  items: [],
  risks: [],
  decisions: [],
};

const PRODUCTS: Product[] = [
  {
    id: PRODUCT_ID,
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
        projectId: PRODUCT_ID,
        stageId: STAGE_DEVELOPMENT_ID,
        name: "Development",
      },
      {
        projectId: PRODUCT_ID,
        stageId: STAGE_TESTING_ID,
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
        { projectId: PRODUCT_ID, stageId: "stage-x", status: "green" },
        { projectId: PRODUCT_ID, stageId: "stage-y", status: "green" },
        { projectId: PRODUCT_ID, stageId: "stage-z", status: "green" },
      ],
    };

    expect(buildSubmitStages(overIndexedDraft, PRODUCTS)).toEqual([
      { projectId: PRODUCT_ID, stageId: "stage-x", name: "Development" },
      { projectId: PRODUCT_ID, stageId: "stage-y", name: "Testing" },
      { projectId: PRODUCT_ID, stageId: "stage-z", name: null },
    ]);
  });

  it("counts duplicate-project statuses by position within the project, not globally", () => {
    const interleavedDraft: DraftSaveContent = {
      ...DRAFT,
      stageStatuses: [
        { projectId: PRODUCT_ID, stageId: "stage-dev", status: "green" },
        { projectId: "product-ghost", stageId: "stage-ghost", status: "green" },
        { projectId: PRODUCT_ID, stageId: "stage-test", status: "yellow" },
      ],
    };

    // The second owned-product status is index 1 within that product (the
    // ghost status does not advance it), so it resolves to Testing.
    expect(buildSubmitStages(interleavedDraft, PRODUCTS)).toEqual([
      { projectId: PRODUCT_ID, stageId: "stage-dev", name: "Development" },
      { projectId: "product-ghost", stageId: "stage-ghost", name: null },
      { projectId: PRODUCT_ID, stageId: "stage-test", name: "Testing" },
    ]);
  });
});

describe("buildLeadSubmitReadiness", () => {
  it("uses the canonical own section projects as the submit denominator", () => {
    const draftSection = makeReportSectionFixture({
      reportSectionId: SECTION_ID,
      version: 3,
      projects: [
        {
          projectId: PRODUCT_ID,
          projectName: "Portal",
          trafficLight: "green",
        },
      ],
    });
    const currentItem = {
      projectId: PRODUCT_ID,
      activityId: null,
      type: "current" as const,
      text: "Ship the report",
      tag: "delivery",
      nextStepText: null,
      workflowStatus: "in_progress" as const,
      carriedOver: false,
      stageNames: ["Development"],
      priorityRank: 1,
      pausedReason: null,
    };
    const products: Product[] = [
      ...PRODUCTS,
      {
        id: "foreign-product",
        name: "Foreign product",
        overallStatus: "on-track",
        stages: [],
      },
    ];

    const readiness = buildLeadSubmitReadiness({
      draftSection,
      draftPayload: {
        ...DRAFT,
        projectStatuses: [{ projectId: PRODUCT_ID, status: "green" }],
        items: [currentItem],
      },
      products,
      autosaveState: "idle",
      submitPending: false,
    });

    expect(readiness.blockingIssues).toEqual([]);
    expect(readiness.canOpenConfirmation).toBe(true);
  });
});

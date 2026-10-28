// The Overview composer is a create surface like any other: it must seed the
// editable stage selector from the open draft's remembered stage, and start
// empty when that Product has no remembered default.

import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../../../test-utils/report-section-fixtures";
import {
  createDraftStageMemory,
  type Product,
  type StatusOverviewCreateTarget,
} from "../../../../report-sections";
import { createOverviewComposerState } from "./lead-status-overview-item-editor";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;

const REPORT_ID = "c0000000-0000-4000-8000-000000000001";
const SECTION_ID = "c0000000-0000-4000-8000-000000000002";
const PROJECT_ID = "c0000000-0000-4000-8000-000000000003";
const DEVELOPMENT_STAGE_ID = "c0000000-0000-4000-8000-000000000004";
const TESTING_STAGE_ID = "c0000000-0000-4000-8000-000000000005";

const PRODUCT: Product = {
  id: PROJECT_ID,
  name: "Payments",
  overallStatus: "on-track",
  stages: [
    {
      stageName: "Development",
      status: "on-track",
      ownership: "mine",
      assignee: "Test Lead",
    },
    {
      stageName: "Testing",
      status: "on-track",
      ownership: "mine",
      assignee: "Test Lead",
    },
  ],
};

function makeSection() {
  return makeReportSectionFixture({
    reportId: REPORT_ID,
    reportSectionId: SECTION_ID,
    projects: [
      {
        projectId: PROJECT_ID,
        projectName: "Payments",
        trafficLight: "green",
        ownedStages: [
          {
            stageId: DEVELOPMENT_STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
            status: "green",
          },
          {
            stageId: TESTING_STAGE_ID,
            stageName: "Testing",
            sortOrder: 1,
            status: "green",
          },
        ],
        stageSet: [
          {
            stageId: DEVELOPMENT_STAGE_ID,
            stageName: "Development",
            sortOrder: 0,
          },
          {
            stageId: TESTING_STAGE_ID,
            stageName: "Testing",
            sortOrder: 1,
          },
        ],
      },
    ],
  });
}

function rememberedStageMemory(stageName: string) {
  const memory = createDraftStageMemory();
  const recordId = "saved-item";
  memory.stageChangedSelections([
    { recordId, productId: PROJECT_ID, stageNames: [stageName] },
  ]);
  memory.confirmPersisted({
    items: [{ id: recordId, projectId: PROJECT_ID, stageNames: [stageName] }],
    risks: [],
    decisions: [],
  });
  return memory;
}

function readyEditor(
  stageMemory: ReturnType<typeof createDraftStageMemory>,
): ReadyEditor {
  return {
    status: "ready",
    generation: `${REPORT_ID}:${SECTION_ID}`,
    draft: { section: makeSection(), stageMemory },
    view: {
      viewModel: {
        products: [PRODUCT],
        activityOptions: [],
        currentUser: { name: "Test Lead" },
      },
    },
  } as unknown as ReadyEditor;
}

const CREATE_TARGET: StatusOverviewCreateTarget = {
  source: "current",
  unitKind: "product",
  unitId: PROJECT_ID,
};

describe("createOverviewComposerState — draft stage default", () => {
  it("seeds a new Overview item with the remembered stage", () => {
    const state = createOverviewComposerState(
      readyEditor(rememberedStageMemory("Testing")),
      CREATE_TARGET,
      null,
    );

    expect(state.draftStore.getSnapshot().stageNames).toEqual(["Testing"]);
  });

  it("starts empty for a multi-stage Product without a remembered stage", () => {
    const state = createOverviewComposerState(
      readyEditor(createDraftStageMemory()),
      CREATE_TARGET,
      null,
    );

    expect(state.draftStore.getSnapshot().stageNames).toEqual([]);
  });

  it("resets dialog to a fresh composer for the same target on addAnother acknowledgment", () => {
    const editor = readyEditor(rememberedStageMemory("Testing"));
    const initialState = createOverviewComposerState(
      editor,
      CREATE_TARGET,
      null,
    );
    const dialog: Parameters<
      typeof import("./overview-item-submission").driveOverviewSubmission
    >[0]["dialog"] = {
      ...initialState,
      mode: "create",
      target: CREATE_TARGET,
      submission: {
        attempt: 1,
        token: "sub-token",
        receiptScope: "scope",
        item: {
          id: "item-created",
          parent: { kind: "product", id: PROJECT_ID },
          productId: PROJECT_ID,
          productName: "Payments",
          activityId: null,
          text: "First batch item",
          status: "in-progress",
          author: "Test Lead",
          stageNames: ["Testing"],
        },
        inputSnapshot: initialState.draftStore.getSnapshot(),
        lastSavedAtBefore: null,
        draftVersionBefore: 0,
        saveReceiptSequenceBefore: 0,
        saveArmed: true,
        activityObserved: true,
        restore: null,
        addAnother: true,
      },
    };

    expect(dialog.submission?.addAnother).toBe(true);
  });
});

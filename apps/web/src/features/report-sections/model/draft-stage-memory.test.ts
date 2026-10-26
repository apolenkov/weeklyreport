import type { ReportSectionReadModel } from "@weeklyreport/shared";
import { describe, expect, it } from "vitest";

import { makeReportSectionFixture } from "../../../test-utils/report-section-fixtures";
import {
  changedStageSelections,
  createDraftStageMemory,
} from "./draft-stage-memory";
import type { DraftPatch } from "./lead-form/draft/lead-form-draft-patch";

const PRODUCT = "44444444-4444-4444-8444-444444444444";
const OTHER_PRODUCT = "55555555-5555-4555-8555-555555555555";
const ITEM = "66666666-6666-4666-8666-666666666666";
const ITEM_STABLE = "77777777-7777-4777-8777-777777777777";
const RISK = "88888888-8888-4888-8888-888888888888";
const DECISION = "99999999-9999-4999-8999-999999999999";

function makeSection(
  overrides: Parameters<typeof makeReportSectionFixture>[0] = {},
): ReportSectionReadModel {
  return makeReportSectionFixture({
    projects: [
      {
        projectId: PRODUCT,
        projectName: "Payments",
        trafficLight: "green",
      },
    ],
    ...overrides,
  });
}

function makeSectionWithItem(stageNames: readonly string[]) {
  return makeSection({
    items: [
      {
        id: ITEM,
        stableId: ITEM_STABLE,
        projectId: PRODUCT,
        activityId: null,
        type: "current",
        text: "Ship the importer",
        tag: "general",
        workflowStatus: "in_progress",
        carriedOver: false,
        stageNames,
      },
    ],
  });
}

function makeSectionWithRisk(stageNames: readonly string[]) {
  return makeSection({
    risks: [
      {
        id: RISK,
        stableId: ITEM_STABLE,
        projectId: PRODUCT,
        activityId: null,
        risk: "Vendor delay",
        impact: "Slips the milestone",
        mitigation: "Escalate",
        severity: "at-risk",
        stageNames,
      },
    ],
  });
}

function makeSectionWithDecision(stageNames: readonly string[]) {
  return makeSection({
    decisions: [
      {
        id: DECISION,
        stableId: ITEM_STABLE,
        productId: PRODUCT,
        activityId: null,
        text: "Approve the vendor",
        owner: "Owner",
        impact: "Unblocks delivery",
        deadline: null,
        resolvedAt: null,
        stageNames,
      },
    ],
  });
}

function itemPatchItem(stageNames: readonly string[]) {
  return {
    id: ITEM,
    stableId: ITEM_STABLE,
    parent: { kind: "product", id: PRODUCT },
    productId: PRODUCT,
    productName: "Payments",
    activityId: null,
    text: "Ship the importer",
    status: "in-progress",
    author: "Test Lead",
    stageNames,
  } as const;
}

const weekItemsPatch = (stageNames: readonly string[]): DraftPatch => ({
  kind: "week-items",
  week: "current",
  items: [itemPatchItem(stageNames)],
});

function riskPatch(stageNames: readonly string[]): DraftPatch {
  return {
    kind: "risks",
    risks: [
      {
        id: RISK,
        productId: PRODUCT,
        productName: "Payments",
        activityId: null,
        impact: "Slips the milestone",
        mitigation: "Escalate",
        severity: "at-risk",
        text: "Vendor delay",
        stageNames,
      },
    ],
  };
}

function decisionPatch(stageNames: readonly string[]): DraftPatch {
  return {
    kind: "decisions",
    decisions: [
      {
        id: DECISION,
        productId: PRODUCT,
        productName: "Payments",
        activityId: null,
        text: "Approve the vendor",
        owner: "Owner",
        impact: "Unblocks delivery",
        deadline: null,
        stageNames,
      },
    ],
  };
}

describe("draft stage memory — only a saved singleton becomes the default", () => {
  it("recalls a singleton recorded by a local record save", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Development"] },
    ]);

    expect(memory.recall(PRODUCT)).toBe("Development");
  });

  it("ignores a deliberate multi-stage save and keeps the previous singleton", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Development"] },
    ]);
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Development", "Testing"] },
    ]);

    expect(memory.recall(PRODUCT)).toBe("Development");
  });

  it("keeps the previously persisted default after a failed save", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Development"] },
    ]);
    memory.confirmPersisted(makeSectionWithItem(["Development"]));
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Testing"] },
    ]);

    expect(memory.recall(PRODUCT)).toBe("Testing");
    memory.noteSaveFailed();
    expect(memory.recall(PRODUCT)).toBe("Development");
  });

  it("promotes a locally saved singleton once the draft persists it", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    memory.confirmPersisted(makeSectionWithItem(["Testing"]));
    memory.noteSaveFailed();

    expect(memory.recall(PRODUCT)).toBe("Testing");
  });

  it("does not confirm a choice the persisted section does not contain", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    memory.confirmPersisted(makeSectionWithItem(["Development"]));

    expect(memory.recall(PRODUCT)).toBe("Testing");
    memory.noteSaveFailed();
    expect(memory.recall(PRODUCT)).toBeUndefined();
  });

  it("confirms persisted risk and decision singletons through their parent field", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    memory.confirmPersisted(makeSectionWithRisk(["Testing"]));
    expect(memory.recall(PRODUCT)).toBe("Testing");
    memory.noteSaveFailed();
    expect(memory.recall(PRODUCT)).toBe("Testing");

    const decisions = createDraftStageMemory();
    decisions.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Development"] },
    ]);
    decisions.confirmPersisted(makeSectionWithDecision(["Development"]));
    expect(decisions.recall(PRODUCT)).toBe("Development");
  });

  it("scopes memory per product and ignores product-less saves", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { productId: PRODUCT, stageNames: ["Development"] },
      { productId: null, stageNames: ["Development"] },
      { productId: "", stageNames: ["Development"] },
    ]);

    expect(memory.recall(PRODUCT)).toBe("Development");
    expect(memory.recall(OTHER_PRODUCT)).toBeUndefined();
    expect(memory.recall(null)).toBeUndefined();
    expect(memory.recall(undefined)).toBeUndefined();
  });
});

describe("changedStageSelections — one diff feeds item, risk and decision saves", () => {
  it("reports a changed item stage selection", () => {
    expect(
      changedStageSelections(
        makeSectionWithItem(["Development"]),
        weekItemsPatch(["Testing"]),
      ),
    ).toEqual([{ productId: PRODUCT, stageNames: ["Testing"] }]);
  });

  it("ignores an item update that keeps the same stage set", () => {
    expect(
      changedStageSelections(
        makeSectionWithItem(["Development"]),
        weekItemsPatch(["Development"]),
      ),
    ).toEqual([]);
  });

  it("does not treat reordered stage arrays as a new choice", () => {
    expect(
      changedStageSelections(
        makeSectionWithItem(["Development", "Testing"]),
        weekItemsPatch(["Testing", "Development"]),
      ),
    ).toEqual([]);
  });

  it("reports a newly created item", () => {
    expect(
      changedStageSelections(makeSection(), weekItemsPatch(["Testing"])),
    ).toEqual([{ productId: PRODUCT, stageNames: ["Testing"] }]);
  });

  it("reports changed risk and decision stage selections", () => {
    expect(
      changedStageSelections(
        makeSectionWithRisk(["Development"]),
        riskPatch(["Development", "Testing"]),
      ),
    ).toEqual([{ productId: PRODUCT, stageNames: ["Development", "Testing"] }]);
    expect(
      changedStageSelections(
        makeSectionWithDecision(["Development"]),
        decisionPatch(["Testing"]),
      ),
    ).toEqual([{ productId: PRODUCT, stageNames: ["Testing"] }]);
  });

  it("reports nothing for patches that are not record saves or without a draft", () => {
    expect(
      changedStageSelections(makeSectionWithItem(["Development"]), {
        kind: "confirm-carried",
      }),
    ).toEqual([]);
    expect(changedStageSelections(null, weekItemsPatch(["Testing"]))).toEqual(
      [],
    );
  });
});

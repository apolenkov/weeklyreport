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
const OTHER_ITEM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
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

function makeItemRow(id: string, stageNames: readonly string[]) {
  return {
    id,
    stableId: id === ITEM ? ITEM_STABLE : `${id}-stable`,
    projectId: PRODUCT,
    activityId: null,
    type: "current" as const,
    text: "Ship the importer",
    tag: "general",
    workflowStatus: "in_progress" as const,
    carriedOver: false,
    stageNames,
  };
}

function makeSectionWithItems(
  items: readonly ReturnType<typeof makeItemRow>[],
): ReportSectionReadModel {
  return makeSection({ items: [...items] });
}

function makeSectionWithItem(stageNames: readonly string[]) {
  return makeSectionWithItems([makeItemRow(ITEM, stageNames)]);
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

// Records an accepted local stage choice and confirms it with the persisted
// section: the two steps the draft performs around a successful save.
function remember(
  memory: ReturnType<typeof createDraftStageMemory>,
  recordId: string,
  stageName: string,
  section: ReportSectionReadModel = makeSectionWithItems([
    makeItemRow(recordId, [stageName]),
  ]),
): void {
  memory.stageChangedSelections([
    { recordId, productId: PRODUCT, stageNames: [stageName] },
  ]);
  memory.confirmPersisted(section);
}

describe("draft stage memory — only a server-confirmed singleton is the default", () => {
  it("does not recall a locally saved choice before the server confirms it", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Testing"] },
    ]);

    expect(memory.recall(PRODUCT)).toBeUndefined();
  });

  it("recalls the singleton once that record's save is confirmed", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    memory.confirmPersisted(makeSectionWithItem(["Testing"]));

    expect(memory.recall(PRODUCT)).toBe("Testing");
  });

  it("confirms a created record through the save's draft-to-server identity", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { recordId: "draft-row-1", productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    memory.confirmPersisted(makeSectionWithItem(["Testing"]), [
      { clientId: "draft-row-1", serverId: ITEM },
    ]);

    expect(memory.recall(PRODUCT)).toBe("Testing");
  });

  it("moves an in-flight edit of a created row to its server identity", () => {
    const memory = createDraftStageMemory();
    const draftRowId = "draft-row-7";
    memory.stageChangedSelections([
      { recordId: draftRowId, productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    // The lead edits the same row again while the save that created it flies.
    memory.stageChangedSelections([
      { recordId: draftRowId, productId: PRODUCT, stageNames: ["Development"] },
    ]);

    // The first save echoes: the row now has a server id and persisted Testing,
    // so the newer local choice stays pending.
    memory.confirmPersisted(makeSectionWithItem(["Testing"]), [
      { clientId: draftRowId, serverId: ITEM },
    ]);
    expect(memory.recall(PRODUCT)).toBeUndefined();

    // The next save writes Development against the server row and confirms it.
    memory.confirmPersisted(makeSectionWithItem(["Development"]), [
      { clientId: ITEM, serverId: ITEM },
    ]);
    expect(memory.recall(PRODUCT)).toBe("Development");
  });

  it("does not confirm an abandoned choice through another record's save", () => {
    const memory = createDraftStageMemory();
    remember(memory, ITEM, "Development");
    memory.stageChangedSelections([
      { recordId: "draft-row-2", productId: PRODUCT, stageNames: ["Testing"] },
    ]);

    // The other record's accepted save persists its own singleton Testing; the
    // abandoned draft row is not part of that save.
    memory.confirmPersisted(
      makeSectionWithItems([makeItemRow(OTHER_ITEM, ["Testing"])]),
      [{ clientId: OTHER_ITEM, serverId: OTHER_ITEM }],
    );

    expect(memory.recall(PRODUCT)).toBe("Development");
  });

  it("does not confirm a record the server persisted without the stage", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    memory.confirmPersisted(makeSectionWithItem(["Development"]), [
      { clientId: ITEM, serverId: ITEM },
    ]);

    expect(memory.recall(PRODUCT)).toBeUndefined();
  });

  it("keeps the persisted default after a failed save", () => {
    const memory = createDraftStageMemory();
    remember(memory, OTHER_ITEM, "Development");
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Testing"] },
    ]);

    expect(memory.recall(PRODUCT)).toBe("Development");
  });

  it("replaces an earlier pending choice when the same record changes again", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Development"] },
    ]);

    memory.confirmPersisted(makeSectionWithItem(["Testing"]));
    expect(memory.recall(PRODUCT)).toBeUndefined();

    memory.confirmPersisted(makeSectionWithItem(["Development"]));
    expect(memory.recall(PRODUCT)).toBe("Development");
  });

  it("drops a pending choice when the same row is widened to several stages", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Development"] },
    ]);
    // The lead deliberately widens the same row while that save is in flight.
    memory.stageChangedSelections([
      {
        recordId: ITEM,
        productId: PRODUCT,
        stageNames: ["Development", "Testing"],
      },
    ]);

    // The earlier singleton is no longer the row's choice, so the in-flight
    // save must not confirm it.
    memory.confirmPersisted(makeSectionWithItem(["Development"]));
    expect(memory.recall(PRODUCT)).toBeUndefined();
  });

  it("drops a pending choice when the same row's stages are cleared", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Development"] },
    ]);
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: [] },
    ]);

    memory.confirmPersisted(makeSectionWithItem(["Development"]));
    expect(memory.recall(PRODUCT)).toBeUndefined();
  });

  it("ignores a deliberate multi-stage save and keeps the previous singleton", () => {
    const memory = createDraftStageMemory();
    remember(memory, OTHER_ITEM, "Development");
    memory.stageChangedSelections([
      {
        recordId: ITEM,
        productId: PRODUCT,
        stageNames: ["Development", "Testing"],
      },
    ]);
    memory.confirmPersisted(
      makeSectionWithItems([makeItemRow(ITEM, ["Development", "Testing"])]),
    );

    expect(memory.recall(PRODUCT)).toBe("Development");
  });

  it("does not invent a default from a multi-stage save without memory", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      {
        recordId: ITEM,
        productId: PRODUCT,
        stageNames: ["Development", "Testing"],
      },
    ]);
    memory.confirmPersisted(
      makeSectionWithItems([makeItemRow(ITEM, ["Development", "Testing"])]),
    );

    expect(memory.recall(PRODUCT)).toBeUndefined();
  });

  it("confirms persisted risk and decision singletons through their parent field", () => {
    const riskMemory = createDraftStageMemory();
    riskMemory.stageChangedSelections([
      { recordId: RISK, productId: PRODUCT, stageNames: ["Testing"] },
    ]);
    riskMemory.confirmPersisted(makeSectionWithRisk(["Testing"]));
    expect(riskMemory.recall(PRODUCT)).toBe("Testing");

    const decisionMemory = createDraftStageMemory();
    decisionMemory.stageChangedSelections([
      { recordId: DECISION, productId: PRODUCT, stageNames: ["Development"] },
    ]);
    decisionMemory.confirmPersisted(makeSectionWithDecision(["Development"]));
    expect(decisionMemory.recall(PRODUCT)).toBe("Development");
  });

  it("scopes memory per product and ignores product-less saves", () => {
    const memory = createDraftStageMemory();
    memory.stageChangedSelections([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Development"] },
      { recordId: OTHER_ITEM, productId: null, stageNames: ["Development"] },
      { recordId: RISK, productId: "", stageNames: ["Development"] },
    ]);

    expect(memory.recall(PRODUCT)).toBeUndefined();
    expect(memory.recall(OTHER_PRODUCT)).toBeUndefined();
    expect(memory.recall(null)).toBeUndefined();
    expect(memory.recall(undefined)).toBeUndefined();
  });
});

describe("changedStageSelections — one diff feeds item, risk and decision saves", () => {
  it("reports a changed item stage selection for its draft record", () => {
    expect(
      changedStageSelections(
        makeSectionWithItem(["Development"]),
        weekItemsPatch(["Testing"]),
      ),
    ).toEqual([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Testing"] },
    ]);
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
    ).toEqual([
      { recordId: ITEM, productId: PRODUCT, stageNames: ["Testing"] },
    ]);
  });

  it("reports changed risk and decision stage selections", () => {
    expect(
      changedStageSelections(
        makeSectionWithRisk(["Development"]),
        riskPatch(["Development", "Testing"]),
      ),
    ).toEqual([
      {
        recordId: RISK,
        productId: PRODUCT,
        stageNames: ["Development", "Testing"],
      },
    ]);
    expect(
      changedStageSelections(
        makeSectionWithDecision(["Development"]),
        decisionPatch(["Testing"]),
      ),
    ).toEqual([
      { recordId: DECISION, productId: PRODUCT, stageNames: ["Testing"] },
    ]);
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

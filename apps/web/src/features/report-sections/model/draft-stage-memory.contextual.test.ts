import { describe, expect, it } from "vitest";

import {
  changedStageSelections,
  createDraftStageMemory,
} from "./draft-stage-memory";
import {
  makeDraftMergeSection,
  PROJECT_ID,
} from "./lead-form/draft/lead-form-draft-merge-test-fixtures";
import { applyDraftPatch } from "./lead-form/draft/lead-form-draft-patch";
import type { DecisionEntry, RiskEntry } from "./types";

const identity = {
  id: "10000000-0000-4000-8000-000000000001",
  stableId: "10000000-0000-4000-8000-000000000002",
};
const common = {
  ...identity,
  productId: PROJECT_ID,
  productName: "Test Product",
  text: "Stage choice",
  stageNames: ["Development"],
  impact: "",
};
const risk: RiskEntry = { ...common, mitigation: "", severity: "at-risk" };
const decision: DecisionEntry = {
  ...common,
  owner: "Test Lead",
  deadline: null,
};

describe.each([
  { kind: "risk" as const, entry: risk },
  { kind: "decision" as const, entry: decision },
])("contextual $kind stage memory", (record) => {
  it("confirms a new stage choice only after its record is persisted", () => {
    const section = makeDraftMergeSection();
    const patch = {
      kind: "create-record" as const,
      reportSectionId: section.reportSectionId,
      record,
    };
    const memory = createDraftStageMemory();
    memory.stageChangedSelections(changedStageSelections(section, patch));
    expect(memory.recall(PROJECT_ID)).toBeUndefined();
    const saved = applyDraftPatch(section, patch);
    memory.confirmPersisted(saved);
    expect(memory.recall(PROJECT_ID)).toBe("Development");
    expect(changedStageSelections(saved, patch)).toEqual([]);
    expect(
      changedStageSelections(saved, {
        ...patch,
        kind: "discard-created-record",
      }),
    ).toEqual([]);
    expect(
      changedStageSelections(section, { ...patch, reportSectionId: "other" }),
    ).toEqual([]);
  });
});

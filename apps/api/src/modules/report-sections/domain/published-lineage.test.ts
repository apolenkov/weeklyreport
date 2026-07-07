import { describe, expect, it } from "vitest";

import {
  snapshotLineageAllSections,
  snapshotLineageForSection,
} from "./published-lineage";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";
const ITEM_LINEAGE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DECISION_LINEAGE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const snapshot = {
  reportId: "22222222-2222-4222-8222-222222222222",
  sections: [
    {
      reportSectionId: SECTION_ID,
      items: [
        { stableId: ITEM_LINEAGE, text: "Published item" },
        // Legacy row serialized before the stableId column existed.
        { text: "Legacy item without lineage" },
      ],
      decisions: [{ stableId: DECISION_LINEAGE, text: "Published decision" }],
    },
    {
      reportSectionId: "99999999-9999-4999-8999-999999999999",
      items: [{ stableId: "other-section-lineage" }],
      decisions: [],
    },
  ],
};

describe("snapshotLineageForSection", () => {
  it("collects item + decision stableIds for exactly the requested section", () => {
    const lineage = snapshotLineageForSection(snapshot, SECTION_ID);
    expect([...lineage.itemStableIds]).toEqual([ITEM_LINEAGE]);
    expect([...lineage.decisionStableIds]).toEqual([DECISION_LINEAGE]);
  });

  it("tolerates a legacy row without a stableId (skipped, no throw)", () => {
    const lineage = snapshotLineageForSection(snapshot, SECTION_ID);
    expect(lineage.itemStableIds.size).toBe(1);
  });

  it("returns empty sets for a never-published report (null snapshot)", () => {
    const lineage = snapshotLineageForSection(null, SECTION_ID);
    expect(lineage.itemStableIds.size).toBe(0);
    expect(lineage.decisionStableIds.size).toBe(0);
  });

  it("returns empty sets when the section is not in the snapshot", () => {
    const lineage = snapshotLineageForSection(
      snapshot,
      "44444444-4444-4444-8444-444444444444",
    );
    expect(lineage.itemStableIds.size).toBe(0);
  });

  it("unions stableIds across every section (all-sections variant)", () => {
    const lineage = snapshotLineageAllSections(snapshot);
    expect([...lineage.itemStableIds].sort()).toEqual(
      [ITEM_LINEAGE, "other-section-lineage"].sort(),
    );
    expect([...lineage.decisionStableIds]).toEqual([DECISION_LINEAGE]);
  });

  it("all-sections variant degrades to empty on a null snapshot", () => {
    const lineage = snapshotLineageAllSections(null);
    expect(lineage.itemStableIds.size).toBe(0);
    expect(lineage.decisionStableIds.size).toBe(0);
  });

  it("degrades to empty on a shape drift instead of throwing", () => {
    expect(
      snapshotLineageForSection({ sections: "garbage" }, SECTION_ID)
        .itemStableIds.size,
    ).toBe(0);
    expect(
      snapshotLineageForSection([1, 2, 3], SECTION_ID).itemStableIds.size,
    ).toBe(0);
  });
});

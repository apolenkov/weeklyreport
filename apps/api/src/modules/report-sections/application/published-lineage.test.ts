import { describe, expect, it } from "vitest";

import {
  resolvePublishedLineage,
  unionPublishedLineage,
} from "./published-lineage";

const SECTION_ID = "11111111-1111-4111-8111-111111111111";

describe("published lineage set rules", () => {
  it("unions own, published/archived, and reopened sources", () => {
    const lineage = unionPublishedLineage([
      { itemStableIds: ["own-item"], decisionStableIds: [] },
      {
        itemStableIds: ["published-item"],
        decisionStableIds: ["archived-decision"],
      },
      {
        itemStableIds: ["reopened-item", "own-item"],
        decisionStableIds: ["reopened-decision"],
      },
    ]);

    expect([...lineage.itemStableIds]).toEqual([
      "own-item",
      "published-item",
      "reopened-item",
    ]);
    expect([...lineage.decisionStableIds]).toEqual([
      "archived-decision",
      "reopened-decision",
    ]);
  });

  it("intersects the union with current candidates in candidate order", () => {
    const lineage = resolvePublishedLineage(
      {
        reportId: "report-1",
        reportSectionId: SECTION_ID,
        itemStableIds: ["draft-item", "own-item", "reopened-item"],
        decisionStableIds: ["archived-decision", "draft-decision"],
      },
      [
        { itemStableIds: ["own-item"], decisionStableIds: [] },
        {
          itemStableIds: ["reopened-item"],
          decisionStableIds: ["archived-decision"],
        },
      ],
    );

    expect(lineage).toEqual({
      itemStableIds: ["own-item", "reopened-item"],
      decisionStableIds: ["archived-decision"],
    });
  });
});

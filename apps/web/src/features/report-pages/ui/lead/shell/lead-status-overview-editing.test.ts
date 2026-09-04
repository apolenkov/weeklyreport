import { describe, expect, it } from "vitest";

import type { KanbanItem } from "../../../../report-sections";
import {
  buildStatusOverviewDetailsHref,
  buildStatusOverviewItemPatch,
} from "./lead-status-overview";

function productItem(id: string, text: string): KanbanItem {
  return {
    id,
    parent: { kind: "product", id: "product-1" },
    productId: "product-1",
    productName: "Payments",
    activityId: null,
    stageNames: ["Development"],
    status: "in-progress",
    text,
    author: "Test Lead",
  };
}

describe("status overview editing bridge", () => {
  it.each(["current", "next"] as const)(
    "builds the canonical %s week-items patch without touching the other week",
    (source) => {
      const current = [productItem("current-1", "Current")];
      const next = [productItem("next-1", "Next")];
      const recordId = source === "current" ? "current-1" : "next-1";
      const updated = productItem(recordId, "Updated in dialog");

      const patch = buildStatusOverviewItemPatch(
        { recordId, source },
        current,
        next,
        updated,
      );

      expect(patch).toEqual({
        kind: "week-items",
        week: source,
        items: [updated],
      });
    },
  );

  it("rejects a stale dialog target instead of replacing another row", () => {
    expect(
      buildStatusOverviewItemPatch(
        { recordId: "missing", source: "current" },
        [productItem("current-1", "Current")],
        [],
        productItem("missing", "Stale"),
      ),
    ).toBeNull();
  });

  it("builds a deterministic details URL and preserves only SitePing context", () => {
    const params = new URLSearchParams({
      siteping: "1",
      sitepingUrl: "/feedback",
      authorId: "foreign-author",
    });

    expect(buildStatusOverviewDetailsHref("report/id", params)).toBe(
      "/lead/report/report%2Fid?mode=edit&siteping=1&sitepingUrl=%2Ffeedback#report-details",
    );
  });
});

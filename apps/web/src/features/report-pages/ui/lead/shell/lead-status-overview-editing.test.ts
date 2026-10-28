import { describe, expect, it } from "vitest";

import type { KanbanItem } from "../../../../report-sections";
import { buildStatusOverviewDetailsHref } from "./lead-status-overview";
import {
  buildStatusOverviewCreatePatch,
  buildStatusOverviewItemPatch,
} from "./lead-status-overview-item-editor";

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

function activityItem(id: string, text: string): KanbanItem {
  return {
    id,
    parent: { kind: "activity", id: "activity-1" },
    productId: null,
    productName: "",
    activityId: "activity-1",
    activityName: "Incident duty",
    stageNames: [],
    status: "planned",
    text,
    author: "Test Lead",
  };
}

describe("status overview editing bridge", () => {
  it.each(["current", "next"] as const)(
    "appends a newly created product item to the %s week only",
    (source) => {
      const current = [productItem("current-1", "Current")];
      const next = [productItem("next-1", "Next")];
      const created = productItem(`${source}-created`, "Created from overview");

      expect(
        buildStatusOverviewCreatePatch(
          { source, unitKind: "product", unitId: "product-1" },
          current,
          next,
          created,
        ),
      ).toEqual({
        kind: "week-items",
        week: source,
        items:
          source === "current" ? [...current, created] : [...next, created],
      });
    },
  );

  it("preserves the activity identity when creating an activity item", () => {
    const created = activityItem("activity-created", "Created activity update");

    expect(
      buildStatusOverviewCreatePatch(
        { source: "next", unitKind: "activity", unitId: "activity-1" },
        [],
        [],
        created,
      ),
    ).toEqual({
      kind: "week-items",
      week: "next",
      items: [
        expect.objectContaining({
          parent: { kind: "activity", id: "activity-1" },
          productId: null,
          activityId: "activity-1",
        }),
      ],
    });
  });

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

  it("builds a deterministic details URL and preserves feedback context", () => {
    const params = new URLSearchParams({
      feedback: "1",
      feedbackUrl: "/feedback",
      agentationSession: "session-1",
      agentationAnnotation: "annotation-1",
      authorId: "foreign-author",
    });

    expect(buildStatusOverviewDetailsHref("report/id", params)).toBe(
      "/lead/report/report%2Fid?mode=edit&feedback=1&feedbackUrl=%2Ffeedback&agentationSession=session-1&agentationAnnotation=annotation-1#report-details",
    );
  });

  it.each([
    "feedback",
    "feedbackUrl",
    "agentationSession",
    "agentationAnnotation",
  ])("drops repeated %s from the details handoff", (key) => {
    const params = new URLSearchParams([
      [key, "first"],
      [key, "second"],
    ]);
    expect(buildStatusOverviewDetailsHref("report-1", params)).toBe(
      "/lead/report/report-1?mode=edit#report-details",
    );
  });

  it("buildStatusOverviewCreatePatch appends item and preserves target week for Save and add another", () => {
    const current = [productItem("current-1", "First item")];
    const second = productItem("current-2", "Second batch item");
    const patch = buildStatusOverviewCreatePatch(
      { source: "current", unitKind: "product", unitId: "product-1" },
      current,
      [],
      second,
    );
    expect(patch).toEqual({
      kind: "week-items",
      week: "current",
      items: [current[0], second],
    });
  });
});

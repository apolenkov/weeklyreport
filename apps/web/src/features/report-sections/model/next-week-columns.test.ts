import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined";
import { splitItemBoard } from "./next-week-columns";
import type { KanbanItem, Product } from "./types";

const PRODUCTS: Product[] = [
  { id: "p1", name: "Portal", overallStatus: "on-track", stages: [] },
];

function item(overrides: Partial<KanbanItem>): KanbanItem {
  return {
    id: "i1",
    productId: "p1",
    productName: "Portal",
    status: "in-progress",
    text: "row",
    author: "Тимлид 1",
    priorityRank: null,
    ...overrides,
  };
}

describe("splitItemBoard — two-level split", () => {
  it("routes product rows to productColumns and activity rows to activityLanes", () => {
    const rows = [
      item({ id: "prod-1" }),
      item({
        id: "act-1",
        productId: "",
        productName: "Jira triage duty",
        activityId: "act-a",
        activityName: "Jira triage duty",
      }),
    ];

    const board = splitItemBoard(PRODUCTS, rows);
    expect(board.productColumns.map((c) => c.key)).toEqual(["Portal"]);
    expect(
      expectDefined(board.productColumns[0]).items.map((i) => i.id),
    ).toEqual(["prod-1"]);
    expect(board.activityLanes.map((c) => c.key)).toEqual(["activity:act-a"]);
    expect(
      expectDefined(board.activityLanes[0]).items.map((i) => i.id),
    ).toEqual(["act-1"]);
  });

  it("returns empty activityLanes when no activity owns rows AND none attached", () => {
    const board = splitItemBoard(PRODUCTS, [item({ id: "prod-only" })]);
    expect(board.activityLanes).toEqual([]);
    expect(board.productColumns).toHaveLength(1);
  });

  it("seeds an empty lane per ATTACHED activity, like a product column", () => {
    // Activities behave like products: an attached activity with no rows still
    // gets an empty lane (with a "+ Add" CTA), so the structure is visible.
    const board = splitItemBoard(
      PRODUCTS,
      [],
      [
        { id: "act-a", name: "Jira triage duty" },
        { id: "act-b", name: "Ops rotation" },
      ],
    );
    expect(board.activityLanes.map((c) => c.productName)).toEqual([
      "Jira triage duty",
      "Ops rotation",
    ]);
    expect(board.activityLanes.every((c) => c.items.length === 0)).toBe(true);
    expect(board.activityLanes.map((c) => c.activityId)).toEqual([
      "act-a",
      "act-b",
    ]);
  });

  it("fills an attached lane with its rows and keeps empty lanes for the rest", () => {
    const rows = [
      item({
        id: "act-row",
        productId: "",
        productName: "Jira triage duty",
        activityId: "act-a",
        activityName: "Jira triage duty",
      }),
    ];
    const board = splitItemBoard(PRODUCTS, rows, [
      { id: "act-a", name: "Jira triage duty" },
      { id: "act-b", name: "Ops rotation" },
    ]);
    const byId = new Map(board.activityLanes.map((c) => [c.activityId, c]));
    expect(byId.get("act-a")?.items.map((i) => i.id)).toEqual(["act-row"]);
    expect(byId.get("act-b")?.items).toEqual([]);
  });

  it("never drops a row whose activity is not in the attached list", () => {
    const rows = [
      item({
        id: "orphan",
        productId: "",
        productName: "Legacy activity",
        activityId: "act-x",
        activityName: "Legacy activity",
      }),
    ];
    const board = splitItemBoard(PRODUCTS, rows, [
      { id: "act-a", name: "Jira triage duty" },
    ]);
    const orphan = board.activityLanes.find((c) => c.activityId === "act-x");
    expect(orphan?.items.map((i) => i.id)).toEqual(["orphan"]);
  });
});

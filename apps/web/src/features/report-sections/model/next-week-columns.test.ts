import { describe, expect, it } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined";
import { splitItemBoard } from "./next-week-columns";
import type { ActivityKanbanItem, Product, ProductKanbanItem } from "./types";

const PRODUCTS: Product[] = [
  { id: "p1", name: "Portal", overallStatus: "on-track", stages: [] },
];

function productItem(
  overrides: Partial<ProductKanbanItem> = {},
): ProductKanbanItem {
  return {
    id: "i1",
    parent: { kind: "product", id: "p1" },
    productId: "p1",
    productName: "Portal",
    activityId: null,
    status: "in-progress",
    text: "row",
    author: "Тимлид 1",
    priorityRank: null,
    stageNames: [],
    ...overrides,
  };
}

function activityItem(
  overrides: Partial<ActivityKanbanItem> = {},
): ActivityKanbanItem {
  return {
    id: "i1",
    parent: { kind: "activity", id: "act-a" },
    productId: null,
    productName: "Jira triage duty",
    activityId: "act-a",
    activityName: "Jira triage duty",
    status: "in-progress",
    text: "row",
    author: "Тимлид 1",
    priorityRank: null,
    stageNames: [],
    ...overrides,
  };
}

describe("splitItemBoard — two-level split", () => {
  it("routes product rows to productColumns and activity rows to activityLanes", () => {
    const rows = [
      productItem({ id: "prod-1" }),
      activityItem({
        id: "act-1",
        activityId: "act-a",
      }),
    ];

    const board = splitItemBoard(PRODUCTS, rows);
    expect(board.productColumns.map((c) => c.key)).toEqual(["p1"]);
    expect(
      expectDefined(board.productColumns[0]).items.map((i) => i.id),
    ).toEqual(["prod-1"]);
    expect(board.activityLanes.map((c) => c.key)).toEqual(["activity:act-a"]);
    expect(
      expectDefined(board.activityLanes[0]).items.map((i) => i.id),
    ).toEqual(["act-1"]);
  });

  it("returns empty activityLanes when no activity owns rows AND none attached", () => {
    const board = splitItemBoard(PRODUCTS, [productItem({ id: "prod-only" })]);
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
      activityItem({
        id: "act-row",
        activityId: "act-a",
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
      activityItem({
        id: "orphan",
        productName: "Legacy activity",
        activityId: "act-x",
        activityName: "Legacy activity",
        parent: { kind: "activity", id: "act-x" },
      }),
    ];
    const board = splitItemBoard(PRODUCTS, rows, [
      { id: "act-a", name: "Jira triage duty" },
    ]);
    const orphan = board.activityLanes.find((c) => c.activityId === "act-x");
    expect(orphan?.items.map((i) => i.id)).toEqual(["orphan"]);
  });

  it("keeps two distinct products with the same display name as separate columns", () => {
    const rows = [
      productItem({ id: "a", productId: "p1", productName: "Portal" }),
      productItem({
        id: "b",
        parent: { kind: "product", id: "p2" },
        productId: "p2",
        productName: "Portal",
      }),
    ];
    const board = splitItemBoard(
      [
        { id: "p1", name: "Portal", overallStatus: "on-track", stages: [] },
        { id: "p2", name: "Portal", overallStatus: "on-track", stages: [] },
      ],
      rows,
    );

    expect(board.productColumns.map((c) => c.productId)).toEqual(["p1", "p2"]);
    expect(board.productColumns.map((c) => c.items.map((i) => i.id))).toEqual([
      ["a"],
      ["b"],
    ]);
  });

  it("appends one column for an orphan product and keeps its stored label and row", () => {
    const rows = [
      productItem({ id: "assigned-row" }),
      productItem({
        id: "orphan-row",
        parent: { kind: "product", id: "p-orphan" },
        productId: "p-orphan",
        productName: "Historical Portal",
      }),
    ];

    const board = splitItemBoard(PRODUCTS, rows);

    expect(board.productColumns.map((column) => column.productId)).toEqual([
      "p1",
      "p-orphan",
    ]);
    expect(expectDefined(board.productColumns[1]).productName).toBe(
      "Historical Portal",
    );
    expect(
      expectDefined(board.productColumns[1]).items.map((item) => item.id),
    ).toEqual(["orphan-row"]);
  });

  it("keeps one stored-product column when the current assignment list is empty", () => {
    const rows = [
      productItem({
        id: "historical-build",
        parent: { kind: "product", id: "p-historical" },
        productId: "p-historical",
        productName: "Historical Platform",
        stageNames: ["Build"],
      }),
      productItem({
        id: "historical-run",
        parent: { kind: "product", id: "p-historical" },
        productId: "p-historical",
        productName: "Historical Platform",
        stageNames: ["Run"],
      }),
    ];

    const board = splitItemBoard([], rows);

    expect(board.productColumns).toHaveLength(1);
    expect(expectDefined(board.productColumns[0])).toMatchObject({
      key: "p-historical",
      productId: "p-historical",
      productName: "Historical Platform",
    });
    expect(
      expectDefined(board.productColumns[0]).items.map((item) => item.id),
    ).toEqual(["historical-build", "historical-run"]);
  });

  it("appends orphan products in first-seen order without duplicates or dropped rows", () => {
    const rows = [
      productItem({ id: "assigned-row" }),
      productItem({
        id: "orphan-b-1",
        parent: { kind: "product", id: "p-orphan-b" },
        productId: "p-orphan-b",
        productName: "Legacy Billing",
      }),
      productItem({
        id: "orphan-a",
        parent: { kind: "product", id: "p-orphan-a" },
        productId: "p-orphan-a",
        productName: "Legacy Analytics",
      }),
      productItem({
        id: "orphan-b-2",
        parent: { kind: "product", id: "p-orphan-b" },
        productId: "p-orphan-b",
        productName: "Legacy Billing (stale label)",
      }),
    ];

    const board = splitItemBoard(PRODUCTS, rows);
    const productColumns = board.productColumns;

    expect(productColumns.map((column) => column.productId)).toEqual([
      "p1",
      "p-orphan-b",
      "p-orphan-a",
    ]);
    expect(productColumns.map((column) => column.productName)).toEqual([
      "Portal",
      "Legacy Billing",
      "Legacy Analytics",
    ]);
    expect(
      productColumns.map((column) => column.items.map((item) => item.id)),
    ).toEqual([["assigned-row"], ["orphan-b-1", "orphan-b-2"], ["orphan-a"]]);

    const renderedProductItemIds = productColumns.flatMap((column) =>
      column.items.map((item) => item.id),
    );
    expect(renderedProductItemIds).toHaveLength(rows.length);
    expect(new Set(renderedProductItemIds)).toEqual(
      new Set(rows.map((row) => row.id)),
    );
  });
});

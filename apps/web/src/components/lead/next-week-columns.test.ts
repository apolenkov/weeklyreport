import { describe, expect, it } from "vitest";

import type { KanbanItem, Product } from "./mock-data";
import { buildItemColumns } from "./next-week-columns";

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

describe("buildItemColumns — activity lanes", () => {
  it("appends one lane per activity that owns rows, after the product columns", () => {
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

    const columns = buildItemColumns(PRODUCTS, rows);
    expect(columns.map((c) => c.key)).toEqual(["Portal", "activity:act-a"]);
    const lane = columns[1];
    expect(lane.activityId).toBe("act-a");
    expect(lane.productName).toBe("Jira triage duty");
    expect(lane.items.map((i) => i.id)).toEqual(["act-1"]);
    // The activity row never leaks into a product column.
    expect(columns[0].items.map((i) => i.id)).toEqual(["prod-1"]);
  });

  it("emits no activity lane when no activity owns rows", () => {
    const columns = buildItemColumns(PRODUCTS, [item({ id: "prod-only" })]);
    expect(columns).toHaveLength(1);
    expect(columns[0].activityId).toBeUndefined();
  });

  it("keeps activity rows in lanes on the fallback (no products) path", () => {
    const rows = [
      item({
        id: "act-2",
        productId: "",
        productName: "Jira triage duty",
        activityId: "act-a",
        activityName: "Jira triage duty",
      }),
    ];
    const columns = buildItemColumns(undefined, rows);
    expect(columns).toHaveLength(1);
    expect(columns[0].activityId).toBe("act-a");
    expect(columns[0].items.map((i) => i.id)).toEqual(["act-2"]);
  });
});

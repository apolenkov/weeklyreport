import { describe, expect, it } from "vitest";

import type { StatusOverviewItem, StatusOverviewUnit } from "./status-overview";
import { buildStatusOverviewLineage } from "./status-overview-lineage";

function item(
  source: StatusOverviewItem["source"],
  stableId: string | null,
): StatusOverviewItem {
  return {
    key: `${source}:${stableId ?? "missing"}`,
    source,
    stableId,
    recordId: `${source}-id`,
    editTarget: null,
    text: "Identical text",
    tag: "feature",
    stageNames: ["Development"],
    pausedReason: null,
    canResolve: false,
    canRestore: false,
    workflowStatus: source === "current" ? "in_progress" : "planned",
    continuity: null,
  };
}

function unit(
  id: string,
  previous: StatusOverviewItem[],
  current: StatusOverviewItem[],
  next: StatusOverviewItem[] = [],
): StatusOverviewUnit {
  return {
    key: `product:${id}`,
    id,
    kind: "product",
    name: id,
    historical: false,
    status: "on-track",
    stages: [],
    linkedProducts: [],
    columns: {
      previouslyPlanned: { availability: "available", items: previous },
      currentWeek: { availability: "available", items: current },
      nextWeek: { availability: "available", items: next },
    },
  };
}

describe("buildStatusOverviewLineage", () => {
  it("joins two views of one local draft record before stable identity is assigned", () => {
    const current = item("current", null);
    const next = {
      ...item("next", null),
      recordId: current.recordId,
      text: "Next step",
    };
    const rows = buildStatusOverviewLineage([
      unit("one", [], [current], [next]),
    ]).get("product:one");
    expect(rows).toHaveLength(1);
    expect(rows?.[0]).toMatchObject({ current, next, previous: null });
  });
  it("joins by lineage despite changed text and independent source ordering", () => {
    const prior = item("previous", "a");
    const current = { ...item("current", "a"), text: "Completed refactoring" };
    const rows = buildStatusOverviewLineage([
      unit("one", [prior], [item("current", "b"), current]),
    ]).get("product:one");
    expect(rows).toHaveLength(2);
    expect(rows?.[0]).toMatchObject({ previous: prior, current, next: null });
    expect(rows?.[1]?.previous).toBeNull();
  });

  it("keeps a moved item in one destination group with prior parent context", () => {
    const prior = item("previous", "a");
    const next = item("next", "a");
    const rows = buildStatusOverviewLineage([
      unit("Old product", [prior], []),
      unit("New product", [], [], [next]),
    ]);
    expect(rows.get("product:Old product")).toEqual([]);
    expect(rows.get("product:New product")).toEqual([
      {
        key: "a",
        previous: prior,
        current: null,
        next,
        previousParent: "Old product",
      },
    ]);
  });

  it("does not infer identity from matching text or missing stable IDs", () => {
    const rows = buildStatusOverviewLineage([
      unit("one", [item("previous", null)], [item("current", null)]),
    ]).get("product:one");
    expect(rows).toHaveLength(2);
    expect(rows?.[0]?.current).toBeNull();
    expect(rows?.[1]?.previous).toBeNull();
  });

  it("does not confuse a prior current update with a new next plan", () => {
    const rows = buildStatusOverviewLineage([
      unit("one", [], [item("current", "current")], [item("next", "next")]),
    ]).get("product:one");
    expect(rows).toHaveLength(2);
    expect(rows?.[0]?.next).toBeNull();
    expect(rows?.[1]?.current).toBeNull();
  });
});

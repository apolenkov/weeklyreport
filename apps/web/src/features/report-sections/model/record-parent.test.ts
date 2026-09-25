import { describe, expect, it } from "vitest";

import type { ParentActivityOption } from "./record-parent";
import { resolveRecordParent } from "./record-parent";

const ACTIVITIES: readonly ParentActivityOption[] = [
  { id: "act-1", name: "Jira triage duty" },
  { id: "act-2", name: "Ops rotation" },
];
const PRODUCTS = [{ id: "p1" }, { id: "p2" }];

describe("resolveRecordParent", () => {
  it("keeps the bound row's activity parent on edit", () => {
    expect(
      resolveRecordParent(
        { activityId: "act-2", productId: null },
        {},
        ACTIVITIES,
        PRODUCTS,
      ),
    ).toEqual({ kind: "activity", id: "act-2" });
  });

  it("keeps the bound row's product parent on edit", () => {
    expect(
      resolveRecordParent({ productId: "p1" }, {}, ACTIVITIES, []),
    ).toEqual({
      kind: "product",
      id: "p1",
    });
  });

  it("seed activity wins over a baked-in row product (activity-lane + Add)", () => {
    // The item dialog bakes its default product into the synthetic create row;
    // an activity lane's + Add must still preselect the activity.
    expect(
      resolveRecordParent(
        { productId: "p1" },
        { activityId: "act-1" },
        ACTIVITIES,
        PRODUCTS,
      ),
    ).toEqual({ kind: "activity", id: "act-1" });
  });

  it("falls back to the seed product in create mode", () => {
    expect(
      resolveRecordParent({}, { productId: "p2" }, ACTIVITIES, PRODUCTS),
    ).toEqual({
      kind: "product",
      id: "p2",
    });
  });

  it("rejects a stale product seed when the caller supplies its catalog", () => {
    expect(
      resolveRecordParent({}, { productId: "stale-product" }, ACTIVITIES, [
        { id: "p1" },
      ]),
    ).toEqual({ kind: "unresolved" });
  });

  it("keeps a valid activity seed ahead of a stale product seed", () => {
    expect(
      resolveRecordParent(
        {},
        { productId: "stale-product", activityId: "act-2" },
        ACTIVITIES,
        [{ id: "p1" }],
      ),
    ).toEqual({ kind: "activity", id: "act-2" });
  });

  it("preserves a historical row parent even when it is absent from the catalog", () => {
    expect(
      resolveRecordParent({ productId: "historical-product" }, {}, ACTIVITIES, [
        { id: "p1" },
      ]),
    ).toEqual({ kind: "product", id: "historical-product" });
  });

  it("falls back to the first activity for an activity-only lead", () => {
    expect(resolveRecordParent({}, {}, ACTIVITIES, [])).toEqual({
      kind: "activity",
      id: "act-1",
    });
  });

  it("returns an explicit unresolved parent when no row, seed, or activity provides an owner", () => {
    // Absence must never be fabricated as a valid-looking product with an
    // empty id — the picker renders an explicit "Select parent…" state instead.
    expect(resolveRecordParent({}, {}, [], [])).toEqual({
      kind: "unresolved",
    });
  });
});

import { describe, expect, it } from "vitest";

import type { ParentActivityOption } from "../ui/parent-picker";
import { resolveRecordParent } from "./record-parent";

const ACTIVITIES: readonly ParentActivityOption[] = [
  { id: "act-1", name: "Jira triage duty" },
  { id: "act-2", name: "Ops rotation" },
];

describe("resolveRecordParent", () => {
  it("keeps the bound row's activity parent on edit", () => {
    expect(
      resolveRecordParent(
        { activityId: "act-2", productId: null },
        {},
        ACTIVITIES,
      ),
    ).toEqual({ kind: "activity", id: "act-2" });
  });

  it("keeps the bound row's product parent on edit", () => {
    expect(resolveRecordParent({ productId: "p1" }, {}, ACTIVITIES)).toEqual({
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
      ),
    ).toEqual({ kind: "activity", id: "act-1" });
  });

  it("falls back to the seed product in create mode", () => {
    expect(resolveRecordParent({}, { productId: "p2" }, ACTIVITIES)).toEqual({
      kind: "product",
      id: "p2",
    });
  });

  it("falls back to the first activity for an activity-only lead", () => {
    expect(resolveRecordParent({}, {}, ACTIVITIES)).toEqual({
      kind: "activity",
      id: "act-1",
    });
  });

  it("returns an explicit unresolved parent when no row, seed, or activity provides an owner", () => {
    // Absence must never be fabricated as a valid-looking product with an
    // empty id — the picker renders an explicit "Select parent…" state instead.
    expect(resolveRecordParent({}, {}, [])).toEqual({ kind: "unresolved" });
  });
});

import { describe, expect, it } from "vitest";

import { sortByPriorityRank } from "./priority-sort";

describe("sortByPriorityRank", () => {
  it("floats ranked rows to the top in ascending rank", () => {
    const rows = [
      { id: "a", priorityRank: 3 },
      { id: "b", priorityRank: 1 },
      { id: "c", priorityRank: 2 },
    ];

    expect(sortByPriorityRank(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps unranked rows in source order, after all ranked rows", () => {
    const rows = [
      { id: "u1", priorityRank: null },
      { id: "p2", priorityRank: 2 },
      { id: "u2", priorityRank: undefined },
      { id: "p1", priorityRank: 1 },
    ];

    expect(sortByPriorityRank(rows).map((r) => r.id)).toEqual([
      "p1",
      "p2",
      "u1",
      "u2",
    ]);
  });

  it("keeps duplicate-rank rows adjacent in source order (stable)", () => {
    const rows = [
      { id: "x", priorityRank: 2 },
      { id: "y", priorityRank: 2 },
      { id: "z", priorityRank: 1 },
    ];

    expect(sortByPriorityRank(rows).map((r) => r.id)).toEqual(["z", "x", "y"]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      { id: "a", priorityRank: 2 },
      { id: "b", priorityRank: 1 },
    ];

    sortByPriorityRank(rows);

    expect(rows.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

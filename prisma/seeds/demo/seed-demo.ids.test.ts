import { describe, expect, it } from "vitest";

import {
  activeItemId,
  activeSectionId,
  activityId,
  makeRowId,
  priorSectionId,
} from "./seed-demo.ids.js";

describe("demo seed id purity", () => {
  it("produces the same id for the same explicit index every time", () => {
    const first = activeItemId(2, 1, 3);
    const second = activeItemId(2, 1, 3);
    expect(second).toBe(first);
    expect(activeSectionId(4)).toBe(activeSectionId(4));
  });

  it("is invariant to the order ids are requested in (no shared counter)", () => {
    // Whatever order the call sites ask for ids, the same (factory, index)
    // pair maps to the same id — row identity is a pure function of the
    // dataset position, not of how many unrelated calls ran first.
    const byIndex = [
      activeSectionId(0),
      activeSectionId(1),
      activeSectionId(2),
    ];
    const shuffled = [
      activeSectionId(2),
      activeSectionId(0),
      activeSectionId(1),
    ];
    expect(byIndex[0]).toBe(shuffled[1]);
    expect(byIndex[1]).toBe(shuffled[2]);
    expect(byIndex[2]).toBe(shuffled[0]);
  });

  it("keeps different factories and indices distinct", () => {
    const ids = new Set([
      makeRowId(0),
      makeRowId(1),
      activeSectionId(0),
      priorSectionId(0, 0),
      activityId(0),
    ]);
    expect(ids.size).toBe(5);
  });

  it("stays inside the demo id namespace", () => {
    expect(activeSectionId(0)).toMatch(/^d0000000-0000-4000-8000-/);
  });
});

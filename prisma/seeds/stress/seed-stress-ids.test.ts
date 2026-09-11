import { describe, expect, it } from "vitest";

import { STRESS_ID_KIND, stressId } from "./seed-stress-ids.js";

const kindValues = Object.values(STRESS_ID_KIND);

describe("stress id kind catalogue", () => {
  it("covers exactly the canonical kinds", () => {
    expect(kindValues).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("accepts every canonical kind and produces distinct id ranges", () => {
    const ids = new Set(kindValues.map((kind) => stressId(kind, 1)));
    expect(ids.size).toBe(kindValues.length);
  });

  it("embeds the kind in the deterministic id prefix", () => {
    expect(stressId(STRESS_ID_KIND.project, 1)).toBe(
      "e0000000-0000-4000-8000-010000000001",
    );
    expect(stressId(STRESS_ID_KIND.item, 1)).toBe(
      "e0000000-0000-4000-8000-060000000001",
    );
  });
});

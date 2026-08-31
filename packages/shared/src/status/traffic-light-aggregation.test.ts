import { describe, expect, it } from "vitest";

import { aggregateTrafficLight } from "./traffic-light-aggregation";

describe("aggregateTrafficLight", () => {
  it("returns the worst set status", () => {
    expect(
      aggregateTrafficLight([undefined, "green", "yellow", null, "red"]),
    ).toBe("red");
  });

  it("ignores unset values", () => {
    expect(aggregateTrafficLight([undefined, "green", null])).toBe("green");
  });

  it("returns null when no status is set", () => {
    expect(aggregateTrafficLight([])).toBeNull();
    expect(aggregateTrafficLight([null, undefined])).toBeNull();
  });
});

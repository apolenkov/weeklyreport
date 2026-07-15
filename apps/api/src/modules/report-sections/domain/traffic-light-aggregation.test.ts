import { describe, expect, it } from "vitest";

import { aggregateTrafficLight } from "./traffic-light-aggregation";

describe("aggregateTrafficLight", () => {
  it("returns red over yellow, green, and missing values", () => {
    expect(
      aggregateTrafficLight([undefined, "green", "yellow", null, "red"]),
    ).toBe("red");
  });

  it("returns yellow when no red value is present", () => {
    expect(aggregateTrafficLight(["green", null, "yellow"])).toBe("yellow");
  });

  it("returns green when it is the only non-null value", () => {
    expect(aggregateTrafficLight([undefined, "green", null])).toBe("green");
  });

  it("returns null for empty or all-null inputs", () => {
    expect(aggregateTrafficLight([])).toBeNull();
    expect(aggregateTrafficLight([null, undefined])).toBeNull();
  });
});

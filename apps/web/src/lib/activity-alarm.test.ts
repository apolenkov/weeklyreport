import { describe, expect, it } from "vitest";

import { deriveActivityAlarmFloor } from "./activity-alarm";

const ACT = "act-a";

describe("deriveActivityAlarmFloor", () => {
  it("returns null with no covering risks", () => {
    expect(deriveActivityAlarmFloor(ACT, [])).toBeNull();
    expect(
      deriveActivityAlarmFloor(ACT, [
        { activityId: "other", severity: "blocked", text: "x" },
        { activityId: null, severity: "blocked", text: "product risk" },
      ]),
    ).toBeNull();
  });

  it("floors to yellow on a covering at-risk risk", () => {
    expect(
      deriveActivityAlarmFloor(ACT, [
        { activityId: ACT, severity: "at-risk", text: "slipping" },
      ]),
    ).toBe("yellow");
  });

  it("floors to red when any covering risk is blocked (worst wins)", () => {
    expect(
      deriveActivityAlarmFloor(ACT, [
        { activityId: ACT, severity: "at-risk", text: "slipping" },
        { activityId: ACT, severity: "blocked", text: "hard stop" },
      ]),
    ).toBe("red");
  });

  it("ignores empty placeholder risks, like the stage floor does", () => {
    expect(
      deriveActivityAlarmFloor(ACT, [
        { activityId: ACT, severity: "blocked", text: " ".repeat(3) },
      ]),
    ).toBeNull();
  });
});

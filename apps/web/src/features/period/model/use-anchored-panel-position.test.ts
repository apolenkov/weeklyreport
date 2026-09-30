import { describe, expect, it } from "vitest";

import { rightAlignedClampedPosition } from "./use-anchored-panel-position";

const rect = (right: number) => ({ right, bottom: 50 });

describe("rightAlignedClampedPosition", () => {
  it("right-aligns to the trigger when there is room", () => {
    expect(rightAlignedClampedPosition(rect(1000), 1440, 340)).toEqual({
      top: 54,
      left: 660,
      width: 340,
    });
  });

  it("keeps the left edge inside the gutter at 375px (trigger right = 105)", () => {
    expect(rightAlignedClampedPosition(rect(105), 375, 340)).toMatchObject({
      left: 16,
      width: 340,
    });
  });

  it("keeps the right edge inside the gutter when the trigger sits at the far edge", () => {
    expect(rightAlignedClampedPosition(rect(375), 375, 340)).toMatchObject({
      left: 19,
      width: 340,
    });
  });

  it("shrinks to the viewport below 372px", () => {
    expect(rightAlignedClampedPosition(rect(200), 320, 340)).toMatchObject({
      left: 16,
      width: 288,
    });
  });
});

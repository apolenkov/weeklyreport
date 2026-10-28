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

  it("bounds the panel vertically when viewport height is constrained (1280x300, 1280x200)", () => {
    // Trigger at top 80, bottom 112 (e.g. toolbar height 32px)
    const triggerRect = { top: 80, bottom: 112, right: 1000 };
    const pos300 = rightAlignedClampedPosition(triggerRect, 1280, 340, {
      viewportHeight: 300,
    });
    // At viewportHeight 300, top = 116, available room below is 300 - 16 - 116 = 168px
    expect(pos300.maxHeight).toBeDefined();
    expect(pos300.maxHeight).toBeLessThanOrEqual(300 - 16 - (pos300.top ?? 0));
    if (pos300.top !== undefined) {
      expect(pos300.top + (pos300.maxHeight ?? 0)).toBeLessThanOrEqual(
        300 - 16,
      );
    }

    const pos200 = rightAlignedClampedPosition(triggerRect, 1280, 340, {
      viewportHeight: 200,
    });
    expect(pos200.maxHeight).toBeDefined();
    if (pos200.top !== undefined) {
      expect(pos200.top + (pos200.maxHeight ?? 0)).toBeLessThanOrEqual(
        200 - 16,
      );
    }
  });
});

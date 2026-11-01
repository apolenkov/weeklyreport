import { describe, expect, it } from "vitest";

import { leftAnchoredPanelPosition } from "./use-listbox-panel-behavior";

const GUTTER = 16;

function trigger(left: number, width: number) {
  return { left, width, top: 70, bottom: 100 };
}

function viewport(width: number, height = 800) {
  return { width, height };
}

describe("leftAnchoredPanelPosition", () => {
  it("lines up under the trigger when the viewport has room", () => {
    expect(
      leftAnchoredPanelPosition(trigger(100, 200), viewport(1440)),
    ).toMatchObject({
      left: 100,
      width: 200,
      top: 104,
      bottom: undefined,
      maxHeight: 280,
    });
  });

  it("keeps the panel inside both gutters at 280px for a trigger wider than the screen", () => {
    // Real defect: a 281px trigger at left 16 produced min-width 281px and a
    // panel right edge of 297px, clipping the Archived badge.
    const pos = leftAnchoredPanelPosition(trigger(16, 281), viewport(280));

    expect(pos).toMatchObject({ left: GUTTER, width: 248 });
    expect(pos.left + pos.width).toBeLessThanOrEqual(280 - GUTTER);
  });

  it("shifts left so a trigger near the right edge keeps its width inside the gutter", () => {
    expect(
      leftAnchoredPanelPosition(trigger(220, 150), viewport(280)),
    ).toMatchObject({ left: 114, width: 150 });
  });

  it("keeps the left edge on the gutter when the trigger starts outside the screen", () => {
    expect(
      leftAnchoredPanelPosition(trigger(-30, 200), viewport(280)),
    ).toMatchObject({ left: GUTTER, width: 200 });
  });

  it("keeps a content-wide panel inside the right gutter at 280px", () => {
    // Real defect: trigger left 75 / width 130 with a 221.5px panel put the
    // right edge at 296.5px, clipping the Archived badge.
    const pos = leftAnchoredPanelPosition(
      trigger(75, 130),
      viewport(280),
      221.5,
    );

    expect(pos.left).toBe(42.5);
    expect(pos.left + 221.5).toBeLessThanOrEqual(280 - GUTTER);
    expect(pos.width).toBe(130);
  });

  it("keeps the trigger-aligned left edge when the measured panel already fits", () => {
    expect(
      leftAnchoredPanelPosition(trigger(75, 130), viewport(1440), 221.5),
    ).toMatchObject({ left: 75, width: 130 });
  });

  it("clamps a measured panel wider than the gutters to the gutter edge", () => {
    expect(
      leftAnchoredPanelPosition(trigger(75, 130), viewport(280), 400),
    ).toMatchObject({ left: GUTTER });
  });

  it("flips above the trigger when there is more room above than below", () => {
    const pos = leftAnchoredPanelPosition(
      { left: 20, width: 200, top: 400, bottom: 430 },
      viewport(600, 500),
    );

    expect(pos.top).toBeUndefined();
    expect(pos.bottom).toBe(500 - 400 + 4);
    expect(pos.maxHeight).toBe(280);
  });
});

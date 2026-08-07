import { describe, expect, it } from "vitest";

import type { GeometrySnapshot } from "./evidence-types.ts";
import { evaluateTransitionVisualPair } from "./transition-visual-evaluation.ts";

const snapshot = (
  overrides: Readonly<{
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    scrollWidth?: number;
    busyCount?: number;
    skeletonCount?: number;
    layoutKey?: string | null;
  }> = {},
): GeometrySnapshot => ({
  viewport: { width: 1440, height: 900 },
  document: {
    scrollWidth: overrides.scrollWidth ?? 1440,
    scrollHeight: 1200,
  },
  loading: {
    busyCount: overrides.busyCount ?? 0,
    skeletonCount: overrides.skeletonCount ?? 0,
  },
  elements: [
    {
      index: 0,
      tagName: "main",
      role: null,
      name: "Report",
      layoutKey:
        overrides.layoutKey === undefined ? "report-page" : overrides.layoutKey,
      layoutStability: "position-width",
      x: overrides.x ?? 100,
      y: overrides.y ?? 120,
      width: overrides.width ?? 1240,
      height: overrides.height ?? 900,
      layoutVisible: true,
      visible: true,
    },
  ],
  issues: [],
});

describe("transition visual evaluation", () => {
  it("accepts skeleton replacement when the stable page geometry matches", () => {
    const before = snapshot({
      busyCount: 1,
      skeletonCount: 12,
      height: 700,
    });
    const after = snapshot({ height: 1200 });

    const result = evaluateTransitionVisualPair(before, after, "none");

    expect(result.outcome).toBe("pass");
    expect(result.issues).toEqual([]);
    expect(result.movements).toContainEqual(
      expect.objectContaining({ layoutKey: "report-page", outcome: "pass" }),
    );
  });

  it("blocks an unexpected stable landmark jump", () => {
    const result = evaluateTransitionVisualPair(
      snapshot(),
      snapshot({ y: 180 }),
      "none",
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues).toContain(
      "stable layout key report-page moved outside x,y,width tolerance",
    );
  });

  it("records the narrow vertical-flow mask for a declared open transition", () => {
    const result = evaluateTransitionVisualPair(
      snapshot(),
      snapshot({ y: 300, height: 1400 }),
      "open",
    );

    expect(result.outcome).toBe("pass");
    expect(result.reviewedMasks).toEqual([
      "declared vertical-flow transition masks y and height movement",
    ]);
  });

  it("blocks a loading state that remains after settle", () => {
    const result = evaluateTransitionVisualPair(
      snapshot({ busyCount: 1, skeletonCount: 8 }),
      snapshot({ busyCount: 1, skeletonCount: 3 }),
      "none",
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues.join(" ")).toContain(
      "loading replacement is incomplete",
    );
  });

  it("blocks horizontal overflow in either side of the pair", () => {
    const result = evaluateTransitionVisualPair(
      snapshot(),
      snapshot({ scrollWidth: 1600 }),
      "none",
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues).toContain("after horizontal overflow is 160px");
  });

  it("blocks a stable layout landmark that disappears", () => {
    const result = evaluateTransitionVisualPair(
      snapshot(),
      snapshot({ layoutKey: null }),
      "none",
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues).toContain(
      "stable layout key report-page disappeared",
    );
  });

  it("blocks a vacuous pair with no shared stable landmarks", () => {
    const result = evaluateTransitionVisualPair(
      snapshot({ layoutKey: null }),
      snapshot({ layoutKey: null }),
      "none",
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues).toContain(
      "transition has no shared stable layout landmarks",
    );
  });
});

import { describe, expect, it } from "vitest";

import type { GeometrySnapshot } from "./evidence-types.ts";
import {
  evaluateTransitionVisualPair,
  FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
} from "./transition-visual-evaluation.ts";

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
    extraLayoutKey?: string;
    hiddenUnkeyedZeroSize?: boolean;
    keyedZeroSize?: boolean;
    issues?: readonly string[];
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
      width: overrides.keyedZeroSize === true ? 0 : (overrides.width ?? 1240),
      height: overrides.keyedZeroSize === true ? 0 : (overrides.height ?? 900),
      layoutVisible: true,
      visible: overrides.keyedZeroSize !== true,
    },
    ...(overrides.extraLayoutKey === undefined
      ? []
      : [
          {
            index: 1,
            tagName: "aside",
            role: null,
            name: "Summary",
            layoutKey: overrides.extraLayoutKey,
            layoutStability: "position-width" as const,
            x: 100,
            y: 120,
            width: 300,
            height: 400,
            layoutVisible: true,
            visible: true,
          },
        ]),
    ...(overrides.hiddenUnkeyedZeroSize === true
      ? [
          {
            index: 2,
            tagName: "button",
            role: "button",
            name: "Open navigation menu",
            layoutKey: null,
            layoutStability: null,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            layoutVisible: true,
            visible: false,
          },
        ]
      : []),
  ],
  issues: overrides.issues ?? [],
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

  it("blocks zero-size geometry under the strict default policy", () => {
    const result = evaluateTransitionVisualPair(
      snapshot({ issues: ["element 0 has zero-size layout"] }),
      snapshot(),
      "none",
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues).toContain("before element 0 has zero-size layout");
  });

  it("filters zero-size geometry under an explicit policy", () => {
    const result = evaluateTransitionVisualPair(
      snapshot({
        hiddenUnkeyedZeroSize: true,
        issues: ["element 2 has zero-size layout"],
      }),
      snapshot({
        hiddenUnkeyedZeroSize: true,
        issues: ["element 2 has zero-size layout"],
      }),
      "none",
      {
        requireNoZeroSize: false,
        allowNoSharedStableLayoutLandmarks: false,
        allowCrossRouteStableLayoutChange: false,
      },
    );

    expect(result.outcome).toBe("pass");
    expect(result.issues).toEqual([]);
    expect(result.reviewedMasks).toContain(
      "transition policy masks unkeyed invisible zero-size geometry issues",
    );
  });

  it("blocks a zero-size stable landmark under the relaxed policy", () => {
    const result = evaluateTransitionVisualPair(
      snapshot({
        keyedZeroSize: true,
        issues: ["element 0 has zero-size layout"],
      }),
      snapshot(),
      "none",
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues).toContain("before element 0 has zero-size layout");
  });

  it("blocks an unresolved zero-size issue under the relaxed policy", () => {
    const result = evaluateTransitionVisualPair(
      snapshot({ issues: ["element 99 has zero-size layout"] }),
      snapshot(),
      "none",
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues).toContain("before element 99 has zero-size layout");
  });

  it("passes an explicit no-landmark policy with a reviewed mask", () => {
    const result = evaluateTransitionVisualPair(
      snapshot({ layoutKey: null }),
      snapshot({ layoutKey: null }),
      "none",
      FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
    );

    expect(result.outcome).toBe("pass");
    expect(result.issues).toEqual([]);
    expect(result.reviewedMasks).toContain(
      "transition policy allows no shared stable layout landmarks",
    );
  });

  it("blocks a stable layout landmark that appears only after", () => {
    const result = evaluateTransitionVisualPair(
      snapshot({ layoutKey: null }),
      snapshot({ layoutKey: null, extraLayoutKey: "after-only" }),
      "none",
    );

    expect(result.outcome).toBe("fail");
    expect(result.issues).toContain(
      "stable layout key after-only appeared after",
    );
  });

  it("masks stable topology only for a proven cross-route policy", () => {
    const policy = {
      ...FROZEN_LIVE_TRANSITION_VISUAL_POLICY,
      allowCrossRouteStableLayoutChange: true,
    };
    const result = evaluateTransitionVisualPair(
      snapshot(),
      snapshot({ layoutKey: "lead-report-body", y: 500 }),
      "none",
      policy,
    );
    const overflow = evaluateTransitionVisualPair(
      snapshot(),
      snapshot({ layoutKey: "lead-report-body", scrollWidth: 1600 }),
      "none",
      policy,
    );

    expect(result.outcome).toBe("pass");
    expect(result.comparison).toBe("cross-route-snapshots");
    expect(result.reviewedMasks.join(" ")).toContain("cross-route navigation");
    expect(overflow.issues).toContain("after horizontal overflow is 160px");
  });
});

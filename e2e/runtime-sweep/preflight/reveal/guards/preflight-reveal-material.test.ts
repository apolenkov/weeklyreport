import { describe, expect, it } from "vitest";

import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import type { RevealBranch } from "../interaction/preflight-reveal-branches.ts";
import {
  controlsForImmediateReveal,
  registerVisitedRevealState,
  revealPathContainsState,
} from "./preflight-reveal-registration.ts";
import { revealSurfaceMaterialFor } from "./reveal-surface-material.ts";

const controlFor = (
  controlKey: string,
  accessibleName = controlKey,
  order = 0,
) => ({
  controlKey,
  ariaRole: "button",
  accessibleName,
  enabled: true,
  order,
  domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
  href: null,
  interactionEffect: null,
});

const branchFor = (
  initialUrl: string,
  url: string,
  surface: ReturnType<typeof revealSurfaceFor>,
): RevealBranch => ({
  path: revealPathFor([], initialUrl),
  inventory: { controls: [], issues: [] },
  surface,
  url,
  preparation: undefined,
});

const branchWithSurfaceTransitionFor = (
  before: ReturnType<typeof revealSurfaceFor>,
  after: ReturnType<typeof revealSurfaceFor>,
): RevealBranch => {
  const source = before.controls[0];
  if (source === undefined)
    throw new Error("Reveal transition fixture requires a source control");
  const beforeUrl = "/lead/report";
  return {
    ...branchFor(beforeUrl, beforeUrl, after),
    path: revealPathFor(
      [
        revealStepFor(
          {
            controlKey: source.controlKey,
            operation: "click",
            safety: "read-only",
            transition: "open",
          },
          before,
          after,
          beforeUrl,
          beforeUrl,
          {
            status: "unchanged",
            beforeDigest: "d".repeat(64),
            afterDigest: "d".repeat(64),
          },
        ),
      ],
      beforeUrl,
    ),
  };
};

describe("reveal material projection", () => {
  it("keeps raw positional evidence while ignoring a pure absolute shift", () => {
    const before = revealSurfaceFor([
      controlFor("button:alpha:0", "Alpha", 1),
      controlFor("button:beta:0", "Beta", 2),
    ]);
    const shifted = revealSurfaceFor([
      controlFor("button:alpha:0", "Alpha", 11),
      controlFor("button:beta:0", "Beta", 12),
    ]);

    expect(shifted.digest).not.toBe(before.digest);
    expect(revealSurfaceMaterialFor(shifted).digest).toBe(
      revealSurfaceMaterialFor(before).digest,
    );
    expect(
      controlsForImmediateReveal(
        branchWithSurfaceTransitionFor(before, shifted),
      ),
    ).toEqual([]);
  });

  it("keeps additions, removals, signature drift, and reorder material", () => {
    const beforeControls = [
      controlFor("button:alpha:0", "Alpha", 1),
      controlFor("button:beta:0", "Beta", 2),
    ];
    const alpha = beforeControls[0];
    const beta = beforeControls[1];
    if (alpha === undefined || beta === undefined)
      throw new Error("Material projection fixture lacks base controls");
    const before = revealSurfaceFor(beforeControls);
    const variants = [
      revealSurfaceFor([
        ...beforeControls,
        controlFor("button:gamma:0", "Gamma", 3),
      ]),
      revealSurfaceFor([alpha]),
      revealSurfaceFor([{ ...alpha, ariaRole: "link" }, beta]),
      revealSurfaceFor([{ ...alpha, accessibleName: "Renamed" }, beta]),
      revealSurfaceFor([{ ...alpha, enabled: false }, beta]),
      revealSurfaceFor([{ ...alpha, href: "/reports" }, beta]),
      revealSurfaceFor([
        { ...alpha, interactionEffect: "client-only" as const },
        beta,
      ]),
      revealSurfaceFor([
        { ...beta, order: 1, domOrderKey: `0001:${beta.controlKey}` },
        { ...alpha, order: 2, domOrderKey: `0002:${alpha.controlKey}` },
      ]),
    ];

    variants.forEach((variant) => {
      expect(revealSurfaceMaterialFor(variant).digest).not.toBe(
        revealSurfaceMaterialFor(before).digest,
      );
    });
  });

  it("converges visited identity and path cycles across a pure shift", () => {
    const before = revealSurfaceFor([
      controlFor("button:alpha:0", "Alpha", 1),
      controlFor("button:beta:0", "Beta", 2),
    ]);
    const shifted = revealSurfaceFor([
      controlFor("button:alpha:0", "Alpha", 11),
      controlFor("button:beta:0", "Beta", 12),
    ]);
    const first = branchFor("/lead/report", "/lead/report", before);
    const second = branchFor("/lead/report", "/lead/report", shifted);
    const visited = registerVisitedRevealState(new Map(), first);
    const repeated = registerVisitedRevealState(
      visited.visitedStatePaths,
      second,
    );

    expect(repeated.isNew).toBe(false);
    expect(repeated.visitedStatePaths.size).toBe(1);
    expect(revealPathContainsState(second, first)).toBe(true);
  });
});

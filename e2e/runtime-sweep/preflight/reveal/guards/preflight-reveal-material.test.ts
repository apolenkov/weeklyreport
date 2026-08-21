import { describe, expect, it } from "vitest";

import {
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import type { RevealBranch } from "../interaction/preflight-reveal-branches.ts";
import { independentDisclosureReductionFor } from "./preflight-reveal-canonicalization.ts";
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

const duplicateDisclosureFixtures = () => {
  const unchanged = {
    status: "unchanged" as const,
    beforeDigest: "d".repeat(64),
    afterDigest: "d".repeat(64),
  };
  const surface = (expandedRows: ReadonlySet<number>) => {
    const occurrences = new Map<string, number>();
    return revealSurfaceFor(
      [0, 1, 2].map((row) => {
        const expanded = expandedRows.has(row);
        const accessibleName = expanded
          ? "Hide action details"
          : "Show action details";
        const occurrence = (occurrences.get(accessibleName) ?? 0) + 1;
        occurrences.set(accessibleName, occurrence);
        const controlKey = `button:${encodeURIComponent(accessibleName)}:${occurrence}`;
        return {
          ...controlFor(controlKey, accessibleName, row + 1),
          ariaControls: `panel-row-${row}`,
          ariaExpanded: expanded,
          disclosureIndependence: "source-bound-row-local" as const,
        };
      }),
    );
  };
  const branch = (
    rows: readonly number[],
    surfaces: readonly ReturnType<typeof surface>[],
  ) => {
    const steps = rows.map((row, index) => {
      const before = surfaces[index];
      const after = surfaces[index + 1];
      if (before === undefined || after === undefined)
        throw new Error("duplicate fixture surface is missing");
      const source = before.controls.find(
        (control) => control.ariaControls === `panel-row-${row}`,
      );
      if (source === undefined)
        throw new Error("duplicate fixture control missing");
      return revealStepFor(
        {
          controlKey: source.controlKey,
          operation: "click",
          safety: "read-only",
          transition: "open",
        },
        before,
        after,
        "/admin",
        "/admin",
        unchanged,
      );
    });
    const finalSurface = surfaces.at(-1);
    if (finalSurface === undefined)
      throw new Error("duplicate fixture final surface is missing");
    return {
      path: revealPathFor(steps, "/admin"),
      inventory: { controls: [], issues: [] },
      surface: finalSurface,
      url: "/admin",
    } satisfies RevealBranch;
  };
  const root = surface(new Set());
  const single = (row: number) =>
    branch([row], [root, surface(new Set([row]))]);
  const pair = (first: number, second: number) =>
    branch(
      [first, second],
      [root, surface(new Set([first])), surface(new Set([first, second]))],
    );
  return {
    candidate: branch(
      [0, 1, 2],
      [
        root,
        surface(new Set([0])),
        surface(new Set([0, 1])),
        surface(new Set([0, 1, 2])),
      ],
    ),
    singles: [single(0), single(1), single(2)],
    pairs: [
      pair(0, 1),
      pair(1, 0),
      pair(0, 2),
      pair(2, 0),
      pair(1, 2),
      pair(2, 1),
    ],
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

  it("canonicalizes identical disclosure siblings by target identity", () => {
    const fixture = duplicateDisclosureFixtures();

    expect(
      independentDisclosureReductionFor({
        branch: fixture.candidate,
        knownBranches: [...fixture.singles, ...fixture.pairs],
      }),
    ).toBe(true);
  });

  it("rejects source-bound accessible-name drift in the combined surface", () => {
    const fixture = duplicateDisclosureFixtures();
    const drifted: RevealBranch = {
      ...fixture.candidate,
      surface: revealSurfaceFor(
        fixture.candidate.surface.controls.map((control) =>
          control.ariaControls === "panel-row-1"
            ? { ...control, accessibleName: "Unexpected details" }
            : control,
        ),
      ),
    };

    expect(
      independentDisclosureReductionFor({
        branch: drifted,
        knownBranches: [...fixture.singles, ...fixture.pairs],
      }),
    ).toBe(false);
  });
});

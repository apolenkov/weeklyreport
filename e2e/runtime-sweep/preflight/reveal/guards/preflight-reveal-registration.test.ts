import { describe, expect, it } from "vitest";

import {
  revealControlPreparationIdentityFor,
  revealPathFor,
  revealStepFor,
  revealSurfaceFor,
} from "../../reveal-path.ts";
import type {
  RevealBranch,
  RevealDiscoveryState,
} from "../interaction/preflight-reveal-branches.ts";
import {
  controlsForImmediateReveal,
  registerDynamicControls,
  registerVisitedRevealState,
  revealPathContainsState,
} from "./preflight-reveal-registration.ts";

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

const surfaceFor = (controlKey: string, accessibleName = controlKey) =>
  revealSurfaceFor([controlFor(controlKey, accessibleName)]);

const branchFor = (
  initialUrl: string,
  url: string,
  surface = surfaceFor("button:Root:0"),
): RevealBranch => ({
  path: revealPathFor([], initialUrl),
  inventory: { controls: [], issues: [] },
  surface,
  url,
  preparation: undefined,
});

const emptyState = (): RevealDiscoveryState => ({
  queue: [],
  controls: [],
  discovered: new Map(),
  visitedStatePaths: new Map(),
  actionCount: 0,
  branchCount: 0,
});

const branchWithSurfaceTransitionFor = (
  before: ReturnType<typeof revealSurfaceFor>,
  after: ReturnType<typeof revealSurfaceFor>,
  afterUrl = "/lead/report",
): RevealBranch => {
  const firstControl = before.controls[0];
  if (firstControl === undefined)
    throw new Error("Reveal transition fixture requires a source control");
  const beforeUrl = "/lead/report";
  return {
    ...branchFor(beforeUrl, afterUrl, after),
    path: revealPathFor(
      [
        revealStepFor(
          {
            controlKey: firstControl.controlKey,
            operation: "click",
            safety: "read-only",
            transition: "open",
          },
          before,
          after,
          beforeUrl,
          afterUrl,
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

describe("reveal registration", () => {
  it("ignores absolute DOM shifts when shared controls retain relative order", () => {
    const before = revealSurfaceFor([
      controlFor("button:alpha:0", "Alpha", 1),
      controlFor("button:beta:0", "Beta", 2),
    ]);
    const after = revealSurfaceFor([
      controlFor("button:inserted:0", "Inserted", 1),
      controlFor("button:alpha:0", "Alpha", 2),
      controlFor("button:beta:0", "Beta", 3),
    ]);
    const branch = branchWithSurfaceTransitionFor(before, after);

    expect(
      controlsForImmediateReveal(branch).map(({ controlKey }) => controlKey),
    ).toEqual(["button:inserted:0"]);
    expect(
      after.controls.find(({ controlKey }) => controlKey === "button:beta:0"),
    ).toMatchObject({
      order: 3,
      domOrderKey: "0003:button:beta:0",
    });
    expect(after.digest).not.toBe(before.digest);
  });

  it("fails closed when shared controls truly reorder", () => {
    const before = revealSurfaceFor([
      controlFor("button:alpha:0", "Alpha", 1),
      controlFor("button:beta:0", "Beta", 2),
    ]);
    const after = revealSurfaceFor([
      controlFor("button:beta:0", "Beta", 1),
      controlFor("button:alpha:0", "Alpha", 2),
    ]);

    expect(
      controlsForImmediateReveal(
        branchWithSurfaceTransitionFor(before, after),
      ).map(({ controlKey }) => controlKey),
    ).toEqual(after.controls.map(({ controlKey }) => controlKey));
  });

  it("distinguishes an ancestor cycle from an alternate path", () => {
    const root = branchFor("/lead/report", "/lead/report");
    const childSurface = surfaceFor("button:Child:0");
    const proof = {
      status: "unchanged" as const,
      beforeDigest: "d".repeat(64),
      afterDigest: "d".repeat(64),
    };
    const child = {
      ...branchFor("/lead/report", "/lead/report?open=1", childSurface),
      path: revealPathFor(
        [
          revealStepFor(
            {
              controlKey: "button:Root:0",
              operation: "click",
              safety: "read-only",
              transition: "open",
            },
            root.surface,
            childSurface,
            root.url,
            "/lead/report?open=1",
            proof,
          ),
        ],
        root.url,
      ),
    };

    expect(revealPathContainsState(child, root)).toBe(true);
    expect(
      revealPathContainsState(
        child,
        branchFor("/lead/report", "/lead/report?alternate=1", root.surface),
      ),
    ).toBe(false);
  });

  it("queues a new semantic state when only the URL changes", () => {
    const surface = surfaceFor("button:Root:0");
    const initial = branchFor("/lead/report", "/lead/report", surface);
    const changedUrl = branchFor(
      "/lead/report",
      "/lead/report?panel=open",
      surface,
    );
    const first = registerVisitedRevealState(new Map(), initial);
    const second = registerVisitedRevealState(
      first.visitedStatePaths,
      changedUrl,
    );

    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(true);
    expect(second.visitedStatePaths.size).toBe(2);
  });

  it("keeps the first path for a repeated semantic state", () => {
    const surface = surfaceFor("button:Root:0");
    const first = branchFor("/lead/report", "/lead/report?panel=open", surface);
    const second = branchFor(
      "/lead/report?panel=closed",
      "/lead/report?panel=open",
      surface,
    );
    const visited = registerVisitedRevealState(new Map(), first);
    const alternate = registerVisitedRevealState(
      visited.visitedStatePaths,
      second,
    );

    expect(alternate.isNew).toBe(false);
    expect(alternate.visitedStatePaths.size).toBe(1);
    expect([...alternate.visitedStatePaths.values()]).toEqual([
      first.path.digest,
    ]);
    expect(
      registerVisitedRevealState(alternate.visitedStatePaths, second).isNew,
    ).toBe(false);
  });

  it("fails closed when a persistent control changes signature", () => {
    const state = emptyState();
    const current = branchFor("/lead/report", "/lead/report");
    const changed = branchFor(
      "/lead/report",
      "/lead/report?panel=open",
      surfaceFor("button:Root:0", "Changed root label"),
    );

    expect(() => registerDynamicControls(state, changed, current)).toThrow(
      /Reveal control signature changed/iu,
    );
  });

  it("registers a same-key control on a different frozen preparation", () => {
    const current = branchFor("/lead/report", "/lead/report");
    const branchSurface = surfaceFor("button:Root:0");
    const proof = {
      status: "unchanged" as const,
      beforeDigest: "d".repeat(64),
      afterDigest: "d".repeat(64),
    };
    const branch = {
      ...branchFor("/lead/report", "/lead/report?dialog=1", branchSurface),
      path: revealPathFor(
        [
          revealStepFor(
            {
              controlKey: "button:Root:0",
              operation: "click",
              safety: "read-only",
              transition: "open",
            },
            current.surface,
            branchSurface,
            current.url,
            "/lead/report?dialog=1",
            proof,
          ),
        ],
        current.url,
      ),
    };
    const initialIdentity = revealControlPreparationIdentityFor(
      "button:Root:0",
      current.path,
      current.surface,
    );
    const seededState: RevealDiscoveryState = {
      ...emptyState(),
      discovered: new Map([
        [
          initialIdentity,
          {
            signature: JSON.stringify(current.surface.controls[0]),
            pathDigest: current.path.digest,
            surfaceDigest: current.surface.digest,
          },
        ],
      ]),
    };

    expect(
      registerDynamicControls(seededState, branch, current).controls.map(
        ({ controlKey }) => controlKey,
      ),
    ).toEqual(["button:Root:0"]);
  });

  it("rejects tampered metadata for an exact scoped identity", () => {
    const branch = branchFor("/lead/report", "/lead/report");
    const identity = revealControlPreparationIdentityFor(
      "button:Root:0",
      branch.path,
      branch.surface,
    );
    const tamperedState: RevealDiscoveryState = {
      ...emptyState(),
      discovered: new Map([
        [
          identity,
          {
            signature: "tampered",
            pathDigest: branch.path.digest,
            surfaceDigest: branch.surface.digest,
          },
        ],
      ]),
    };

    expect(() =>
      registerDynamicControls(tamperedState, branch, branch),
    ).toThrow(/Reveal control signature changed/iu);
  });
});

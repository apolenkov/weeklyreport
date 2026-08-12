import { describe, expect, it, vi } from "vitest";

import type { CampaignMatrixState } from "../matrix/campaign-matrix.ts";
import type {
  DomControlObservation,
  DomInventory,
} from "../replay/dom/dom-inventory.ts";
import type { Action } from "../source/contracts.ts";
import { sha256Hex, stableSerialize } from "../support/ids.ts";
import { preflightControlForPlan } from "./execution/playwright-preflight.ts";
import {
  discoverRevealControls,
  type RevealExecution,
  type RevealExecutionHarness,
} from "./reveal/interaction/preflight-reveal-discovery.ts";
import { revealPathFor, revealSurfaceFor } from "./reveal-path.ts";
const route = { resolvedRoute: "/lead/report" } as const;
const state: CampaignMatrixState = {
  profile: "minimal",
  stateId: "state-00000001",
  pairwiseDigest: "a".repeat(64),
  axes: {
    role: "lead",
    route: "lead:/lead/report",
    profileCapability: "canonical-identities",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "allowed",
    fault: "none",
    controlTransition: "none",
  },
};
const observation = (
  controlKey: string,
  accessibleName: string,
  role = "button",
  order = 0,
): DomControlObservation => ({
  controlKey,
  domOrderKey: `${String(order).padStart(4, "0")}:${controlKey}`,
  order,
  role,
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: role === "dialog" ? "section" : "button",
  inputType: null,
  href: null,
});
const rootControl = observation("button:Root action:0", "Root action");
const openControl = observation("button:Open menu:0", "Open menu", "button", 1);
const viewControl = observation(
  "button:View details:0",
  "View details",
  "button",
  1,
);
const closeControl = observation(
  "button:Close dialog:0",
  "Close dialog",
  "button",
  1,
);
const dialogControl = observation("dialog:Details:0", "Details", "dialog", 2);
const inventory = (
  controls: readonly DomControlObservation[],
): DomInventory => ({ controls, issues: [] });
const rootInventory = inventory([rootControl, openControl]);
const menuInventory = inventory([rootControl, viewControl]);
const dialogInventory = inventory([rootControl, closeControl, dialogControl]);
const DATABASE_DIGEST = "d".repeat(64);
const absoluteBrowserUrl = (route: string): string =>
  new URL(route, "http://127.0.0.1:3205").href;
type FixtureMode = "root" | "menu" | "dialog";
type ProofMode = "valid" | "missing" | "changed";
const fixture = (
  options: Readonly<{
    readonly crossRoute?: boolean;
    readonly proof?: ProofMode;
  }> = {},
): Readonly<{
  readonly initialInventory: DomInventory;
  readonly events: () => readonly string[];
  readonly harness: RevealExecutionHarness;
}> => {
  const recordEvent = vi.fn<(event: string) => void>();
  const events = (): readonly string[] =>
    recordEvent.mock.calls.map(([event]) => event);
  const mode = (): FixtureMode => {
    const recorded = events();
    const start = recorded.lastIndexOf("prepare");
    return recorded
      .slice(start + 1)
      .filter((event) => event.startsWith("execute:"))
      .map((event) => event.slice("execute:".length))
      .reduce<FixtureMode>(
        (current, controlKey) =>
          controlKey === openControl.controlKey
            ? "menu"
            : controlKey === viewControl.controlKey
              ? "dialog"
              : controlKey === closeControl.controlKey
                ? "root"
                : current,
        "root",
      );
  };
  const inventoryForMode = (): DomInventory =>
    mode() === "root"
      ? rootInventory
      : mode() === "menu"
        ? menuInventory
        : dialogInventory;
  const currentPath = (): string =>
    mode() === "menu"
      ? options.crossRoute === true
        ? "/other?menu=1#open"
        : "/lead/report?menu=1#open"
      : mode() === "dialog"
        ? "/lead/report?dialog=1#open"
        : "/lead/report";
  const currentUrl = (): string => absoluteBrowserUrl(currentPath());
  const executeReveal = ({
    action,
  }: {
    readonly control: DomControlObservation;
    readonly action: Action;
  }): Promise<RevealExecution> => {
    recordEvent(`execute:${action.controlKey}`);
    const result = {
      url: currentUrl(),
      inventory: inventoryForMode(),
    };
    if (options.proof !== "missing")
      return Promise.resolve({
        ...result,
        nonMutation: {
          status: "unchanged",
          beforeDigest: DATABASE_DIGEST,
          afterDigest:
            options.proof === "changed" ? "e".repeat(64) : DATABASE_DIGEST,
        },
      });
    return Promise.resolve(result as unknown as RevealExecution);
  };
  const harness: RevealExecutionHarness = {
    prepare: () => {
      recordEvent("prepare");
      return Promise.resolve();
    },
    navigate: () => {
      recordEvent("navigate");
      return Promise.resolve();
    },
    currentUrl,
    inventory: () => {
      recordEvent("inventory");
      return Promise.resolve(inventoryForMode());
    },
    executeReveal,
  };
  return { initialInventory: rootInventory, events, harness };
};
const discover = async (
  options: Readonly<{
    readonly crossRoute?: boolean;
    readonly proof?: ProofMode;
    readonly maxDepth?: number;
    readonly maxBranches?: number;
    readonly maxActions?: number;
  }> = {},
) => {
  const testFixture = fixture(options);
  const controls = await discoverRevealControls({
    state,
    route,
    initialInventory: testFixture.initialInventory,
    harness: testFixture.harness,
    controlFor: preflightControlForPlan,
    ...(options.maxDepth === undefined ? {} : { maxDepth: options.maxDepth }),
    ...(options.maxBranches === undefined
      ? {}
      : { maxBranches: options.maxBranches }),
    ...(options.maxActions === undefined
      ? {}
      : { maxActions: options.maxActions }),
  });
  return { controls, events: testFixture.events() };
};
describe("deterministic reveal paths", () => {
  it("freezes an empty initial path and deterministic semantic surface", async () => {
    const path = revealPathFor();
    const surface = revealSurfaceFor(rootInventory.controls);
    expect(path.steps).toEqual([]);
    expect(path.digest).toBe(sha256Hex({ initialUrl: "/", steps: [] }));
    expect(revealSurfaceFor(rootInventory.controls)).toEqual(surface);
    const controls = (await discover()).controls;
    expect(new Set(controls.map(({ controlKey }) => controlKey))).toEqual(
      new Set([
        closeControl.controlKey,
        openControl.controlKey,
        rootControl.controlKey,
        viewControl.controlKey,
        dialogControl.controlKey,
      ]),
    );
    expect(
      controls.filter(
        ({ controlKey }) => controlKey === rootControl.controlKey,
      ),
    ).toHaveLength(3);
  });
  it("binds interaction-effect semantics into the frozen surface digest", () => {
    const clientOnly = {
      ...rootControl,
      interactionEffect: "client-only" as const,
    };
    const mutationRequired = {
      ...rootControl,
      interactionEffect: "mutation-required" as const,
    };
    const clientSurface = revealSurfaceFor([clientOnly]);
    const mutationSurface = revealSurfaceFor([mutationRequired]);

    expect(clientSurface.controls[0]?.interactionEffect).toBe("client-only");
    expect(mutationSurface.controls[0]?.interactionEffect).toBe(
      "mutation-required",
    );
    expect(clientSurface.digest).not.toBe(mutationSurface.digest);
  });
  it("discovers nested controls without dropping persistent or disappearing controls", async () => {
    const result = await discover();
    const byKey = new Map(
      result.controls.map((control) => [control.controlKey, control]),
    );
    expect(byKey.size).toBe(5);
    expect(byKey.get(openControl.controlKey)?.revealPath.steps).toHaveLength(0);
    expect(byKey.get(viewControl.controlKey)?.revealPath.steps).toHaveLength(1);
    expect(byKey.get(closeControl.controlKey)?.revealPath.steps).toHaveLength(
      2,
    );
    expect(byKey.get(dialogControl.controlKey)?.revealPath.steps).toHaveLength(
      2,
    );
    result.events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => event.startsWith("execute:"))
      .forEach(({ index }) => {
        const lastPrepare = result.events.lastIndexOf("prepare", index);
        expect(lastPrepare).toBeGreaterThanOrEqual(0);
        expect(result.events.slice(lastPrepare, index)).toContain("navigate");
      });
    const stable = stableSerialize(result.controls);
    expect(stable).toBe(stableSerialize((await discover()).controls));
  });
  it("bounds discovery and rejects missing database mutation proofs", async () => {
    await expect(discover({ maxDepth: 1 })).rejects.toThrow(/depth bound/iu);
    await expect(discover({ maxBranches: 1 })).rejects.toThrow(
      /branch bound/iu,
    );
    await expect(discover({ maxActions: 1 })).rejects.toThrow(/action bound/iu);
    await expect(discover({ maxBranches: 0 })).rejects.toThrow(
      /branch bound must be a positive integer/iu,
    );
    await expect(discover({ maxActions: 0 })).rejects.toThrow(
      /action bound must be a positive integer/iu,
    );
    const crossRoute = await discover({ crossRoute: true });
    expect(crossRoute.controls.map(({ controlKey }) => controlKey)).toEqual([
      openControl.controlKey,
      rootControl.controlKey,
    ]);
    expect(
      crossRoute.controls.find(
        ({ controlKey }) => controlKey === openControl.controlKey,
      )?.expectedActionTransition?.afterUrl,
    ).toBe("/other?menu=1#open");
    await expect(discover({ proof: "missing" })).rejects.toThrow(
      /database-oracle proof/iu,
    );
    await expect(discover({ proof: "changed" })).rejects.toThrow(
      /database-oracle proof/iu,
    );
  });
});
